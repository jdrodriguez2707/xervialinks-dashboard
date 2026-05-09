const { Router } = require("express");
const gamNetworks = require("../controllers/gamNetworks.controller");

const router = Router();

router.get("/", gamNetworks.listNetworks);
router.get("/service-account-email", gamNetworks.getServiceAccountEmail);
router.get("/sa-invite-research", gamNetworks.getSaInviteResearch);
router.post("/", gamNetworks.createNetwork);
router.patch("/:code/display-name", gamNetworks.updateDisplayName);
router.patch("/:code/default", gamNetworks.setDefault);
router.post("/:code/verify", gamNetworks.verifyAccess);
router.post("/:code/sync", gamNetworks.syncNetworkNow);
router.delete("/:code", gamNetworks.deleteNetwork);

module.exports = router;
