import { Router } from "express";
import { CreateTripBody, CorrectTripBody, ListTripsQueryParams } from "@workspace/api-zod";
import { q,transaction,requireAuth,requireAdmin,required,nonnegative,fail,mapTrip,audit,maybeAlert,vehicles, type Client } from "../lib/fleet-store";

export const tripsRouter=Router();
tripsRouter.use(requireAuth);
async function validateTrip(c:Client,input:any,correction=false){
  required(input.origin,input.destination);
  nonnegative(input.initialKm,input.finalKm);
  if(input.finalKm<input.initialKm)fail("El kilometraje final no puede ser menor al inicial.");
  if(input.refueled){
    if(input.liters==null||input.fuelCost==null)fail("Ingresa los litros y el costo del combustible.");
    nonnegative(input.liters,input.fuelCost);
  }else{input.liters=0;input.fuelCost=0;}
  input.companions=input.companions||"";
  input.observations=input.observations||"";
  if(input.companions.length>5000||input.observations.length>10000)fail("El texto ingresado es demasiado extenso.");
  const v=(await c.query("SELECT * FROM fleet_vehicles WHERE id=$1",[input.vehicleId])).rows[0];
  const d=(await c.query("SELECT * FROM fleet_drivers WHERE id=$1",[input.driverId])).rows[0];
  if(!v||(!correction&&!v.data.active))fail("Selecciona un vehículo activo.");
  if(!d||(!correction&&!d.data.active))fail("Selecciona un conductor activo.");
  if(!correction&&input.initialKm<v.data.currentKm)fail(`El kilometraje inicial no puede ser menor al actual (${v.data.currentKm} km).`);
  return {v,d,data:{...input,driverName:d.data.name,plate:v.plate,distance:input.finalKm-input.initialKm,corrected:correction}};
}
tripsRouter.post("/trips",async(req,res)=>{
  const input=CreateTripBody.parse(req.body);
  if(res.locals.actor.role==="driver"&&input.driverId!==res.locals.actor.driverId)fail("Solo puedes registrar viajes a tu nombre.",403);
  res.json(await transaction(async c=>{
    const {v,data}=await validateTrip(c,input);
    const row=(await c.query("INSERT INTO fleet_trips(vehicle_id,driver_id,data) VALUES($1,$2,$3) RETURNING *",[input.vehicleId,input.driverId,data])).rows[0];
    const next={...v.data,currentKm:input.finalKm};
    await c.query("UPDATE fleet_vehicles SET data=$1 WHERE id=$2",[next,v.id]);
    await maybeAlert(c,{...next,id:v.id});
    await audit(c,res.locals.actor,"Viaje registrado",null,{...data,id:row.id});
    return mapTrip(row);
  }));
});
tripsRouter.put("/trips/:id",requireAdmin,async(req,res)=>{
  const input=CorrectTripBody.parse(req.body);
  required(input.reason);
  res.json(await transaction(async c=>{
    const old=(await c.query("SELECT * FROM fleet_trips WHERE id=$1",[Number(req.params.id)])).rows[0];
    if(!old)fail("Viaje no encontrado.",404);
    const {v,data}=await validateTrip(c,input.trip,true);
    const {rows:others}=await c.query("SELECT * FROM fleet_trips WHERE vehicle_id=$1 AND id<>$2 ORDER BY at,id",[v.id,old.id]);
    const before=others.filter(r=>new Date(r.at)<new Date(old.at)||(new Date(r.at).getTime()===new Date(old.at).getTime()&&r.id<old.id)).at(-1);
    const after=others.find(r=>new Date(r.at)>new Date(old.at)||(new Date(r.at).getTime()===new Date(old.at).getTime()&&r.id>old.id));
    if(input.trip.initialKm<(before?.data.finalKm ?? v.data.baselineKm))fail("La corrección contradice el kilometraje anterior del vehículo.");
    if(after&&input.trip.finalKm>after.data.initialKm)fail("La corrección supera el kilometraje inicial del viaje siguiente.");
    const row=(await c.query("UPDATE fleet_trips SET vehicle_id=$1,driver_id=$2,data=$3 WHERE id=$4 RETURNING *",[v.id,input.trip.driverId,data,old.id])).rows[0];
    for(const vehicleId of new Set<number>([old.vehicle_id,v.id])){
      const vr=(await c.query("SELECT * FROM fleet_vehicles WHERE id=$1",[vehicleId])).rows[0];
      const last=(await c.query("SELECT data FROM fleet_trips WHERE vehicle_id=$1 ORDER BY at DESC,id DESC LIMIT 1",[vehicleId])).rows[0];
      const next={...vr.data,currentKm:Math.max(vr.data.baselineKm,vr.data.lastMaintenanceKm,last?.data.finalKm||0)};
      await c.query("UPDATE fleet_vehicles SET data=$1 WHERE id=$2",[next,vehicleId]);
      await maybeAlert(c,{...next,id:vehicleId});
    }
    await audit(c,res.locals.actor,`Viaje #${old.id} corregido`,mapTrip(old),mapTrip(row),input.reason.trim());
    return mapTrip(row);
  }));
});
export async function filteredTrips(query:Record<string,unknown>){
  const parsed=ListTripsQueryParams.parse(query);
  for(const value of [parsed.from,parsed.to])if(value&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))fail("Selecciona fechas válidas.");
  if(parsed.from&&parsed.to&&parsed.from>parsed.to)fail("La fecha desde debe ser anterior a la fecha hasta.");
  if(parsed.refueled&&!["true","false"].includes(parsed.refueled))fail("Filtro de combustible inválido.");
  const filters:string[]=[];const params:unknown[]=[];
  const add=(clause:string,val:unknown)=>{params.push(val);filters.push(clause.replace("?",`$${params.length}`));};
  if(parsed.from)add("(at AT TIME ZONE 'America/Santiago')::date >= ?::date",parsed.from);
  if(parsed.to)add("(at AT TIME ZONE 'America/Santiago')::date <= ?::date",parsed.to);
  if(parsed.vehicleId)add("vehicle_id = ?::integer",parsed.vehicleId);
  if(parsed.driverId)add("driver_id = ?::integer",parsed.driverId);
  if(parsed.plate)add("data->>'plate' ILIKE ?",`%${parsed.plate}%`);
  if(parsed.refueled)add("(data->>'refueled')::boolean = ?::boolean",parsed.refueled);
  return (await q.query(`SELECT * FROM fleet_trips ${filters.length?"WHERE "+filters.join(" AND "):""} ORDER BY at DESC,id DESC`,params)).rows.map(mapTrip);
}
tripsRouter.get("/trips",requireAdmin,async(req,res)=>{res.json(await filteredTrips(req.query));});
tripsRouter.get("/fuel",requireAdmin,async(req,res)=>{
  const trips=await filteredTrips(req.query);
  const fleet=await vehicles();
  res.json(fleet.filter(v=>!req.query.vehicleId||String(v.id)===req.query.vehicleId).map(v=>{
    const all=trips.filter(t=>t.vehicleId===v.id);
    const fills=all.filter(t=>t.refueled);
    const liters=fills.reduce((sum,t)=>sum+t.liters,0);
    const cost=fills.reduce((sum,t)=>sum+t.fuelCost,0);
    const distance=all.reduce((sum,t)=>sum+t.distance,0);
    return {vehicleId:v.id,plate:v.plate,liters,cost,loads:fills.length,averageLiters:fills.length?liters/fills.length:0,distance,kmPerLiter:liters?distance/liters:0};
  }));
});
tripsRouter.get("/dashboard",requireAdmin,async(_req,res)=>{
  const fleet=await vehicles();
  const totals=(await q.query(`SELECT count(*)::int AS trips,COALESCE(sum((data->>'distance')::numeric),0)::float AS distance,
    COALESCE(sum((data->>'fuelCost')::numeric),0)::float AS cost FROM fleet_trips
    WHERE date_trunc('month',at AT TIME ZONE 'America/Santiago')=date_trunc('month',now() AT TIME ZONE 'America/Santiago')`)).rows[0];
  const recent=(await q.query("SELECT * FROM fleet_trips ORDER BY at DESC,id DESC LIMIT 6")).rows.map(mapTrip);
  const active=Number((await q.query("SELECT count(*) AS n FROM fleet_drivers WHERE (data->>'active')::boolean")).rows[0].n);
  res.json({vehicles:fleet.filter(v=>v.active),recentTrips:recent,totalTrips:totals.trips,totalDistance:totals.distance,fuelCost:totals.cost,activeDrivers:active});
});
