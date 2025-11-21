const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/gridQuestController');
const analyticsCtrl = require('../controllers/gridQuestAnalyticsController');

// Task management routes
router.get('/tasks', ctrl.listTasks);
router.get('/tasks/:id', ctrl.getTask);
router.post('/tasks', ctrl.createTask);
router.patch('/tasks/:id', ctrl.updateTask);
router.patch('/tasks/:id/status', ctrl.updateStatus);
router.delete('/tasks/:id', ctrl.deleteTask);

// Analytics routes
router.get('/sessions', analyticsCtrl.getTeacherSessions);
router.get('/sessions/:sessionId/analytics', analyticsCtrl.getSessionAnalytics);
router.get('/sessions/:sessionId/export', analyticsCtrl.exportSessionToExcel);

module.exports = router;



