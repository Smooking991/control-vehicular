import { ReplitConnectors } from "@replit/connectors-sdk";
import { q, transaction, digest } from "./fleet-store";
import { logger } from "./logger";

export async function emailConnected(): Promise<boolean> {
  try {
    const connections = await new ReplitConnectors().listConnections({connector_names:"resend"});
    return connections.some(c=>c.connector_name==="resend" && !["error","revoked","disconnected","expired"].includes(c.status || ""));
  } catch { return false; }
}
let running=false;
export async function deliverAlerts(){
  if(running)return;
  running=true;
  try{
    const admin=(await q.query("SELECT email,sender FROM fleet_admin WHERE id=1")).rows[0];
    if(!admin?.email||!admin.sender||!await emailConnected())return;
    await transaction(async c=>{
      const {rows}=await c.query(`SELECT a.*,v.plate,v.data FROM fleet_alerts a JOIN fleet_vehicles v ON v.id=a.vehicle_id
        WHERE a.status='pending' AND a.next_attempt<=now() ORDER BY a.id LIMIT 1 FOR UPDATE OF a`);
      const a=rows[0];
      if(!a)return;
      if(a.cycle!==(a.data.maintenanceCycle||0)){
        await c.query("UPDATE fleet_alerts SET status='superseded' WHERE id=$1",[a.id]);return;
      }
      // Stable provider key prevents duplicate delivery on retry during its 24h window.
      // Twelve bounded retries remain inside that window; exhausted jobs need review.
      try{
        const response=await new ReplitConnectors().proxy("resend","/emails",{
          method:"POST",
          headers:{"Content-Type":"application/json","Idempotency-Key":`fleet-${digest(`${admin.email}:${a.plate}:${a.id}:${a.cycle}`)}`},
          body:{from:admin.sender,to:[admin.email],subject:`Mantención próxima: ${a.plate}`,
            text:`El vehículo ${a.plate} requiere atención de mantención.\nKilometraje actual: ${a.data.currentKm} km.\nPróxima mantención: ${a.data.nextMaintenanceKm} km.\nKilómetros restantes: ${a.data.nextMaintenanceKm-a.data.currentKm} km.\nRevisa Control Vehicular para coordinar la mantención.`}
        });
        if(!response.ok)throw new Error(`Proveedor de correo HTTP ${response.status}`);
        await c.query("UPDATE fleet_alerts SET status='sent',sent_at=now(),attempts=attempts+1 WHERE id=$1",[a.id]);
        await c.query("INSERT INTO fleet_audit(data) VALUES($1)",[{actor:"Sistema",action:"Aviso de mantención enviado",reason:"",before:"null",after:JSON.stringify({vehicleId:a.vehicle_id,plate:a.plate})}]);
      }catch{
        await c.query(`UPDATE fleet_alerts SET attempts=attempts+1,status=CASE WHEN attempts>=11 THEN 'failed' ELSE 'pending' END,
          next_attempt=now()+interval '1 minute'*LEAST(60,power(2,attempts+1)) WHERE id=$1`,[a.id]);
        logger.warn({alertId:a.id},"No se pudo entregar el aviso de mantención; reintento controlado");
      }
    });
  }catch(err){logger.error({err},"Error procesando avisos de mantención");}
  finally{running=false;}
}
