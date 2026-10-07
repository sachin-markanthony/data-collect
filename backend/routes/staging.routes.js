const express = require('express');
const router = express.Router();
const stagingController = require('../controllers/staging.controller');

// Master lookups for review UI dropdowns
router.get('/masters', stagingController.getMasterLookups);
router.get('/masters/amenities', stagingController.getAmenitiesMaster);
router.get('/masters/cities', stagingController.searchCitiesMaster);
router.get('/masters/locations', stagingController.searchLocationsMaster);
router.get('/masters/builders', stagingController.searchBuildersMaster);
router.post('/masters/amenity', stagingController.createMasterAmenity);
router.post('/masters/city', stagingController.createMasterCity);
router.post('/masters/location', stagingController.createMasterLocation);
router.post('/masters/builder', stagingController.createMasterBuilder);

// Pipeline trigger endpoints
router.post('/pipeline/run', stagingController.runPipeline);
router.post('/pipeline/crawl', stagingController.crawlWebsite);

// Staging CRUD & review actions
router.get('/staging', stagingController.getStagedProjects);
router.get('/staging/:id', stagingController.getStagedProjectById);
router.patch('/staging/:id', stagingController.updateStagedProject);
router.post('/staging/:id/approve', stagingController.approveStagedProject);
router.post('/staging/:id/reject', stagingController.rejectStagedProject);
router.post('/staging/:id/apply-update', stagingController.applyUpdateToProject);
router.delete('/staging/clear', stagingController.clearStagedProjects);

module.exports = router;
