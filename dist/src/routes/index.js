/**
 * Routes aggregator
 */
import { Router } from "express";
import completionsRouter from "./completions.js";
import modelsRouter from "./models.js";
const router = Router();
// Use completions routes
router.use("/", completionsRouter);
// Use models route
router.use("/", modelsRouter);
export default router;
//# sourceMappingURL=index.js.map