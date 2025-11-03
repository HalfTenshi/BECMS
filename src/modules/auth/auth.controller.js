import authService from "./auth.service.js";

class AuthController {
  async register(req, res) {
    try {
      const data = await authService.register(req.body);
      res.status(201).json(data);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  async login(req, res) {
    try {
      const data = await authService.login(req.body);
      res.json(data);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  async me(req, res) {
    // req.user disediakan dari middleware auth
    try {
      res.json({ user: req.user.profile });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  async requestReset(req, res) {
    try {
      const data = await authService.requestReset(req.body);
      res.json(data);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  async resetPassword(req, res) {
    try {
      const data = await authService.resetPassword(req.body);
      res.json(data);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }
   // === NEW ===
  async googleOneTap(req, res) {
    try {
      const { idToken } = req.body; // FE kirim credential dari Google
      if (!idToken) return res.status(400).json({ error: "idToken is required" });

      const data = await authService.loginWithGoogleIdToken(idToken);
      return res.json(data);
    } catch (e) {
      return res.status(401).json({ error: e.message || "Google login failed" });
    }
  }
}

export default new AuthController();
