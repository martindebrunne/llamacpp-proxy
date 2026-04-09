/**
 * Completions routes
 */

import { Router } from "express";
import { forwardJsonPost } from "../services/proxy.js";

const router = Router();

// Intercept chat completions
router.post(
  ["/chat/completions", "/v1/chat/completions"],
  async (req, res) => {
    await forwardJsonPost(req, res, "/v1/chat/completions");
  }
);

// Intercept completions
router.post(
  ["/completions", "/v1/completions"],
  async (req, res) => {
    await forwardJsonPost(req, res, "/v1/completions");
  }
);

export default router;