// controllers/notificationController.js
const Notification = require('../models/Notification');
const catchAsync   = require('../utils/catchAsync');
const AppError     = require('../utils/AppError');

// GET all notifications for the logged-in user
exports.getMyNotifications = catchAsync(async (req, res) => {
  const { isRead, page = 1, limit = 20 } = req.query;
  const filter = { recipient: req.user._id };
  if (isRead !== undefined) filter.isRead = isRead === 'true';

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit))
      .populate('relatedBus',   'busNumber')
      .populate('relatedRoute', 'routeNumber routeName'),
    Notification.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, count: notifications.length, total, notifications });
});

// MARK one notification as read
exports.markAsRead = catchAsync(async (req, res, next) => {
  const notif = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
  if (!notif) return next(new AppError('Notification not found.', 404));
  res.status(200).json({ success: true, notification: notif });
});

// MARK ALL as read
exports.markAllAsRead = catchAsync(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() }
  );
  res.status(200).json({ success: true, message: 'All notifications marked as read.' });
});

// CREATE notification (admin/system use — also called internally by socket handler)
exports.createNotification = catchAsync(async (req, res) => {
  const notif = await Notification.create({
    ...req.body,
    recipient: req.body.recipientId || req.user._id,
  });
  res.status(201).json({ success: true, notification: notif });
});

// DELETE a notification
exports.deleteNotification = catchAsync(async (req, res, next) => {
  const notif = await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
  if (!notif) return next(new AppError('Notification not found.', 404));
  res.status(200).json({ success: true, message: 'Notification deleted.' });
});
