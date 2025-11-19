const BuzzerBattleTask = require('../models/BuzzerBattleTask');

exports.listTasks = async (req, res) => {
  try {
    const query = {};
    if (req.query.subjectId) query.subjectId = req.query.subjectId;
    if (req.query.teacherId) query.teacherId = req.query.teacherId;
    const items = await BuzzerBattleTask.find(query).sort({ createdAt: -1 });
    res.json(items);
  } catch (e) {
    res.status(500).json({ message: 'Failed to list Buzzer Battle tasks' });
  }
};

exports.getTask = async (req, res) => {
  try {
    const item = await BuzzerBattleTask.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json(item);
  } catch (e) {
    res.status(500).json({ message: 'Failed to get task' });
  }
};

exports.createTask = async (req, res) => {
  try {
    const created = await BuzzerBattleTask.create(req.body);
    res.status(201).json(created);
  } catch (e) {
    res.status(400).json({ message: 'Failed to create task' });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const updated = await BuzzerBattleTask.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ message: 'Failed to update task' });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    await BuzzerBattleTask.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ message: 'Failed to delete task' });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['draft', 'published', 'closed'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be: draft, published, or closed' });
    }

    const updated = await BuzzerBattleTask.findByIdAndUpdate(
      req.params.id, 
      { status }, 
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json(updated);
  } catch (e) {
    res.status(400).json({ message: 'Failed to update status' });
  }
};

