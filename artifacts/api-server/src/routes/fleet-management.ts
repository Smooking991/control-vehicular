import { Router } from "express";
import { CreateVehicleBody, UpdateVehicleBody, CreateDriverBody, UpdateDriverBody, CreateMaintenanceBody, UpdateSettingsBody } from "@workspace/api-zod";
import { q, transaction, vehicles, mapVehicle, requireAuth, requireAdmin, required, nonnegative, fail, hashPin, audit, maybeAlert } from "../lib/fleet-store";
import { emailConnected } from "../lib/fleet-email";

export const managementRouter = Router();
managementRouter.use(requireAuth);
managementRouter.get("/vehicles", async (_req,res) => {
  const data=await vehicles();
  res.json(res.locals.actor.role==="admin"?data:data.filter(v=>v.active));
});
managementRouter.get("/drivers",requireAdmin,async(_req,res)=>{
  res.json((await q.query("SELECT id,data FROM fleet_drivers ORDER BY data->>'name'")).rows.map(r=>({...r.data,id:r.id})));
});
for(const method of ["post","put"] as const){
  managementRouter[method](method==="post"?"/vehicles":"/vehicles/:id",requireAdmin,async(req,res)=>{
    const input=(method==="post"?CreateVehicleBody:UpdateVehicleBody).parse(req.body);
    required(input.plate,input.brand,input.model);
    input.plate=input.plate.toUpperCase().replace(/[^A-Z0-9]/g,"");
    if(!/^[A-Z]{2,4}[0-9]{2,4}$/.test(input.plate) || input.plate.length!==6) fail("Ingresa una patente chilena válida de 6 caracteres.");
    nonnegative(input.currentKm,input.lastMaintenanceKm,input.nextMaintenanceKm,input.maintenanceInterval);
    if(input.maintenanceInterval<=0) fail("El intervalo de mantención debe ser mayor a cero.");
    if(input.lastMaintenanceKm>input.currentKm || input.nextMaintenanceKm<=input.lastMaintenanceKm) fail("Revisa los kilometrajes de mantención.");
    if(input.year<1950 || input.year>new Date().getFullYear()+1) fail("Ingresa un año válido.");
    const result=await transaction(async c=>{
      const old=method==="put"?(await c.query("SELECT * FROM fleet_vehicles WHERE id=$1",[Number(req.params.id)])).rows[0]:null;
      if(method==="put"&&!old)fail("Vehículo no encontrado.",404);
      if(old){
        const floor=(await c.query("SELECT COALESCE(max((data->>'finalKm')::numeric),0) AS km FROM fleet_trips WHERE vehicle_id=$1",[old.id])).rows[0].km;
        if(input.currentKm<Number(floor))fail("El kilometraje no puede ser menor al último viaje. Corrige el viaje con trazabilidad.");
      }
      const data={...input,maintenanceCycle:old?.data.maintenanceCycle || 0,baselineKm:old && input.currentKm===old.data.currentKm ? old.data.baselineKm : input.currentKm};
      const row=old
        ? (await c.query("UPDATE fleet_vehicles SET plate=$1,data=$2 WHERE id=$3 RETURNING *",[input.plate,data,old.id])).rows[0]
        : (await c.query("INSERT INTO fleet_vehicles(plate,data) VALUES($1,$2) RETURNING *",[input.plate,data])).rows[0];
      await audit(c,res.locals.actor,old?"Vehículo actualizado":"Vehículo creado",old?.data || null,input);
      await maybeAlert(c,{...data,id:row.id});
      return mapVehicle(row);
    });
    res.json(result);
  });
  managementRouter[method](method==="post"?"/drivers":"/drivers/:id",requireAdmin,async(req,res)=>{
    const input=(method==="post"?CreateDriverBody:UpdateDriverBody).parse(req.body);
    required(input.name);
    const hash=input.pin?await hashPin(input.pin,"driver"):null;
    if(method==="post"&&!hash)fail("Asigna un PIN de exactamente 4 dígitos.");
    res.json(await transaction(async c=>{
      const old=method==="put"?(await c.query("SELECT * FROM fleet_drivers WHERE id=$1",[Number(req.params.id)])).rows[0]:null;
      if(method==="put"&&!old)fail("Conductor no encontrado.",404);
      const data={name:input.name.trim(),active:input.active};
      const row=old
        ? (await c.query("UPDATE fleet_drivers SET data=$1,pin_hash=$2 WHERE id=$3 RETURNING id,data",[data,hash || old.pin_hash,old.id])).rows[0]
        : (await c.query("INSERT INTO fleet_drivers(data,pin_hash) VALUES($1,$2) RETURNING id,data",[data,hash])).rows[0];
      if(old&&(hash||!input.active))await c.query("DELETE FROM fleet_sessions WHERE driver_id=$1",[old.id]);
      await audit(c,res.locals.actor,old?"Conductor actualizado":"Conductor creado",old?.data || null,{...data,pinChanged:!!hash});
      return {...row.data,id:row.id};
    }));
  });
}
managementRouter.get("/maintenances",requireAdmin,async(_req,res)=>{
  res.json((await q.query("SELECT id,data FROM fleet_maintenances ORDER BY data->>'date' DESC,id DESC")).rows.map(r=>({...r.data,id:r.id})));
});
managementRouter.post("/maintenances",requireAdmin,async(req,res)=>{
  const input=CreateMaintenanceBody.parse(req.body);
  required(input.date,input.type,input.description);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||Number.isNaN(Date.parse(input.date))||new Date(input.date).toISOString().slice(0,10)!==input.date)fail("La fecha de mantención no es válida.");
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Santiago",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  if(input.date>today)fail("No se puede registrar una mantención futura.");
  nonnegative(input.km,input.cost,input.nextMaintenanceKm);
  if(input.nextMaintenanceKm<=input.km)fail("La próxima mantención debe ser posterior al kilometraje de esta mantención.");
  res.json(await transaction(async c=>{
    const v=(await c.query("SELECT * FROM fleet_vehicles WHERE id=$1",[input.vehicleId])).rows[0];
    if(!v)fail("Vehículo no encontrado.",404);
    if(input.km<v.data.lastMaintenanceKm)fail("El kilometraje no puede ser menor a la última mantención.");
    const latest=(await c.query("SELECT data->>'date' AS date FROM fleet_maintenances WHERE vehicle_id=$1 ORDER BY data->>'date' DESC LIMIT 1",[v.id])).rows[0];
    if(latest&&input.date<latest.date)fail("Registra una fecha igual o posterior a la última mantención.");
    const data={...input,plate:v.plate,actor:res.locals.actor.name};
    const row=(await c.query("INSERT INTO fleet_maintenances(vehicle_id,data) VALUES($1,$2) RETURNING id",[v.id,data])).rows[0];
    const next={...v.data,currentKm:Math.max(v.data.currentKm,input.km),lastMaintenanceKm:input.km,nextMaintenanceKm:input.nextMaintenanceKm,maintenanceInterval:input.nextMaintenanceKm-input.km,maintenanceCycle:(v.data.maintenanceCycle||0)+1};
    await c.query("UPDATE fleet_vehicles SET data=$1 WHERE id=$2",[next,v.id]);
    await c.query("UPDATE fleet_alerts SET status='superseded' WHERE vehicle_id=$1 AND status='pending'",[v.id]);
    await maybeAlert(c,{...next,id:v.id});
    await audit(c,res.locals.actor,"Mantención registrada",v.data,data);
    return {...data,id:row.id};
  }));
});
async function settings(){
  const row=(await q.query("SELECT email,sender FROM fleet_admin WHERE id=1")).rows[0];
  return {adminEmail:row.email,senderEmail:row.sender,emailConnected:await emailConnected(),pendingAlerts:Number((await q.query("SELECT count(*) AS n FROM fleet_alerts WHERE status='pending'")).rows[0].n)};
}
managementRouter.get("/settings",requireAdmin,async(_req,res)=>{res.json(await settings());});
managementRouter.put("/settings",requireAdmin,async(req,res)=>{
  const input=UpdateSettingsBody.parse(req.body);
  const valid=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  if(!valid(input.adminEmail)||(input.senderEmail&&!valid(input.senderEmail)))fail("Ingresa correos electrónicos válidos.");
  await transaction(async c=>{
    const old=(await c.query("SELECT email,sender FROM fleet_admin WHERE id=1")).rows[0];
    await c.query("UPDATE fleet_admin SET email=$1,sender=$2 WHERE id=1",[input.adminEmail,input.senderEmail]);
    await audit(c,res.locals.actor,"Configuración de correo actualizada",old,input);
  });
  res.json(await settings());
});
managementRouter.get("/audit",requireAdmin,async(_req,res)=>{
  res.json((await q.query("SELECT * FROM fleet_audit ORDER BY at DESC,id DESC LIMIT 500")).rows.map(r=>({...r.data,id:r.id,at:new Date(r.at).toISOString()})));
});
