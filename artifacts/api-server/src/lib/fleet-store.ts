import { pool, type PoolClient } from "@workspace/db";
import type { Request, Response, NextFunction } from "express";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

export const q = pool;
export type Client = PoolClient;
export type Actor = { role: string; name: string; driverId?: number };
export function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}
export async function transaction<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    // Small fleet: serialize writes so validation and odometer changes are atomic.
    await c.query("SELECT pg_advisory_xact_lock(7612026)");
    const result = await fn(c);
    await c.query("COMMIT");
    return result;
  } catch (err) {
    await c.query("ROLLBACK");
    throw err;
  } finally { c.release(); }
}
const scryptAsync = promisify(scrypt);
export async function hashPin(pin: string, role: "admin" | "driver" = "admin") {
  if (!(role === "driver" ? /^\d{4}$/ : /^\d{6,12}$/).test(pin))
    fail(role === "driver" ? "El PIN del conductor debe tener exactamente 4 dígitos." : "El PIN debe tener entre 6 y 12 dígitos.");
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(pin, salt, 64) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}
export async function verifyPin(pin: string, hash: string) {
  if (typeof pin !== "string" || pin.length > 128) return false;
  const [salt, expected] = hash.split(":");
  if (!salt || !expected) return false;
  const derived = await scryptAsync(pin, salt, 64) as Buffer;
  const target = Buffer.from(expected, "hex");
  return target.length === derived.length && timingSafeEqual(derived, target);
}
export const digest = (s: string) => createHash("sha256").update(s).digest("hex");
export async function session(req: Request): Promise<Actor | undefined> {
  const token = req.cookies?.fleet_session;
  if (!token || typeof token !== "string") return;
  const { rows } = await q.query(`SELECT s.role,s.driver_id,d.data,a.name
    FROM fleet_sessions s LEFT JOIN fleet_drivers d ON d.id=s.driver_id
    LEFT JOIN fleet_admin a ON s.role='admin' AND a.id=1
    WHERE s.token_hash=$1 AND s.expires>now()`, [digest(token)]);
  const r = rows[0];
  if (!r || (r.role === "driver" && !r.data?.active)) return;
  return { role: r.role, name: r.role === "admin" ? r.name : r.data.name, ...(r.driver_id ? {driverId: r.driver_id} : {}) };
}
export async function issueSession(res: Response, actor: Actor) {
  const token = randomBytes(32).toString("hex");
  await q.query("INSERT INTO fleet_sessions(token_hash,role,driver_id,expires) VALUES($1,$2,$3,now()+interval '12 hours')", [digest(token), actor.role, actor.driverId || null]);
  res.cookie("fleet_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 12*60*60*1000, path: "/" });
  return { authenticated: true, setupRequired: false, ...actor };
}
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const actor = await session(req);
  if (!actor) { res.status(401).json({error:"Ingresa con tu PIN para continuar."}); return; }
  res.locals.actor = actor; next();
}
export function requireAdmin(_req: Request, res: Response, next: NextFunction) {
  if (res.locals.actor.role !== "admin") { res.status(403).json({error:"Solo Administración puede realizar esta acción."}); return; }
  next();
}
export async function audit(c: Client, actor: Actor, action: string, before: unknown, after: unknown, reason = "") {
  await c.query("INSERT INTO fleet_audit(data) VALUES($1)", [{actor:actor.name,action,reason,before:JSON.stringify(before),after:JSON.stringify(after)}]);
}
export function nonnegative(...values: number[]) {
  if (values.some(v => !Number.isFinite(v) || v < 0 || v > 1e12)) fail("Los valores numéricos deben ser positivos o cero.");
}
export function required(...values: string[]) {
  if (values.some(v => typeof v !== "string" || !v.trim() || v.length > 5000)) fail("Completa todos los campos obligatorios.");
}
export const mapTrip = (r: any) => ({...r.data,id:r.id,vehicleId:r.vehicle_id,driverId:r.driver_id,at:new Date(r.at).toISOString()});
export function mapVehicle(r: any) {
  const data = r.data;
  const remainingKm = data.nextMaintenanceKm - data.currentKm;
  return {...data,id:r.id,plate:r.plate,remainingKm,status:remainingKm<0?"overdue":remainingKm<=1000?"urgent":remainingKm<5000?"warning":"normal",lastDriver:r.last_driver || "",lastRecord:r.last_record ? new Date(r.last_record).toISOString() : ""};
}
export async function vehicles(c: Pick<Client,"query"> = q) {
  const {rows} = await c.query(`SELECT v.*, t.data->>'driverName' AS last_driver,t.at AS last_record
    FROM fleet_vehicles v LEFT JOIN LATERAL (SELECT data,at FROM fleet_trips WHERE vehicle_id=v.id ORDER BY at DESC,id DESC LIMIT 1) t ON true ORDER BY v.plate`);
  return rows.map(mapVehicle);
}
export async function maybeAlert(c: Client, vehicle: any) {
  if (vehicle.nextMaintenanceKm - vehicle.currentKm >= 5000) return;
  await c.query("INSERT INTO fleet_alerts(vehicle_id,cycle) VALUES($1,$2) ON CONFLICT DO NOTHING", [vehicle.id,vehicle.maintenanceCycle || 0]);
}
