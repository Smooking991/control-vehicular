import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { authRouter } from "./fleet-auth";
import { tripsRouter } from "./fleet-trips";
import { managementRouter } from "./fleet-management";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(tripsRouter);
router.use(managementRouter);

export default router;
