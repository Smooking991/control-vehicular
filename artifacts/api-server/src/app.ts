import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.disable("x-powered-by");
app.use(cookieParser());
app.use((req,res,next)=>{
  res.setHeader("X-Content-Type-Options","nosniff");
  if(!["GET","HEAD","OPTIONS"].includes(req.method)){
    const origin=req.get("origin");
    const host=req.get("x-forwarded-host") || req.get("host");
    if(req.get("sec-fetch-site")==="cross-site" || (origin&&new URL(origin).host!==host)){
      res.status(403).json({error:"Solicitud de origen no permitido."});return;
    }
  }
  next();
});
app.use(express.json({limit:"64kb"}));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use((err: any,req: express.Request,res: express.Response,_next: express.NextFunction)=>{
  if(err.name==="ZodError"){
    res.status(400).json({error:"Revisa los campos obligatorios y sus formatos."});return;
  }
  if(err.code==="23505"){
    res.status(409).json({error:"Ya existe un registro con estos datos. Revisa la patente."});return;
  }
  if(err.code==="22P02"){
    res.status(400).json({error:"Identificador o filtro inválido."});return;
  }
  const status=err.status || 500;
  if(status>=500)req.log.error({err},"Error procesando solicitud");
  res.status(status).json({error:status>=500?"No fue posible guardar la información. Intenta nuevamente.":err.message});
});

export default app;
