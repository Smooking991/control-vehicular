import { Router } from "express";
import { SetupAdminBody, LoginBody } from "@workspace/api-zod";
import { q, transaction, hashPin, verifyPin, session, issueSession, digest, fail, required } from "../lib/fleet-store";

export const authRouter = Router();
authRouter.use((_req,res,next)=>{res.set("Cache-Control","no-store");next();});
authRouter.get("/session", async (req,res) => {
  const actor = await session(req);
  const exists = (await q.query("SELECT id FROM fleet_admin WHERE id=1")).rowCount;
  res.json({authenticated:!!actor,setupRequired:!exists,...actor});
});
authRouter.post("/setup", async (req,res) => {
  if ((await q.query("SELECT id FROM fleet_admin WHERE id=1")).rowCount) fail("El administrador ya fue configurado.",409);
  const input = SetupAdminBody.parse(req.body);
  required(input.name);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) fail("Ingresa un correo válido.");
  const hash = await hashPin(input.pin);
  await transaction(async c => {
    if ((await c.query("SELECT id FROM fleet_admin WHERE id=1")).rowCount) fail("El administrador ya fue configurado.",409);
    await c.query("INSERT INTO fleet_admin(id,name,pin_hash,email) VALUES(1,$1,$2,$3)", [input.name.trim(),hash,input.email.trim()]);
  });
  res.json(await issueSession(res,{role:"admin",name:input.name.trim()}));
});
authRouter.get("/drivers/public", async (_req,res) => {
  const {rows} = await q.query("SELECT id,data FROM fleet_drivers WHERE (data->>'active')::boolean ORDER BY data->>'name'");
  res.json(rows.map(r=>({id:r.id,name:r.data.name,active:true})));
});
authRouter.post("/login", async (req,res) => {
  const input = LoginBody.parse(req.body);
  const key = digest(`${req.ip}:${input.role}:${input.driverId || 0}`);
  const limit = await q.query(`INSERT INTO fleet_login_attempts(key,attempts,reset_at) VALUES($1,1,now()+interval '15 minutes')
    ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN fleet_login_attempts.reset_at<now() THEN 1 ELSE fleet_login_attempts.attempts+1 END,
    reset_at=CASE WHEN fleet_login_attempts.reset_at<now() THEN now()+interval '15 minutes' ELSE fleet_login_attempts.reset_at END RETURNING attempts`,[key]);
  if (limit.rows[0].attempts>8) fail("Demasiados intentos. Espera 15 minutos.",429);
  if(input.role==="driver"&&!/^\d{4}$/.test(input.pin))fail("El PIN del conductor debe tener exactamente 4 dígitos. Si usabas uno más largo, solicita uno nuevo a Administración.",400);
  const row = input.role==="admin"
    ? (await q.query("SELECT name,pin_hash FROM fleet_admin WHERE id=1")).rows[0]
    : (await q.query("SELECT data->>'name' AS name,pin_hash FROM fleet_drivers WHERE id=$1 AND (data->>'active')::boolean",[input.driverId || 0])).rows[0];
  if (!row || !await verifyPin(input.pin,row.pin_hash)) fail("Identificación o PIN incorrecto.",401);
  await q.query("DELETE FROM fleet_login_attempts WHERE key=$1",[key]);
  res.json(await issueSession(res,{role:input.role,name:row.name,...(input.role==="driver"?{driverId:input.driverId}:{})}));
});
authRouter.post("/logout",async(req,res)=>{
  if(req.cookies?.fleet_session) await q.query("DELETE FROM fleet_sessions WHERE token_hash=$1",[digest(req.cookies.fleet_session)]);
  res.clearCookie("fleet_session",{path:"/"});
  res.json({message:"Sesión cerrada"});
});
