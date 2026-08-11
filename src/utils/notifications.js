// ============================================================
//  Life OS — 通知管理工具
//  使用 expo-notifications 实现课程提醒、任务 DDL 提醒、打卡提醒
// ============================================================
import { Platform } from 'react-native';
import { isHabitActiveOnDate } from './helpers';

// Web 环境：expo-notifications 不可用，全部操作静默返回
const isWeb = Platform.OS === 'web';

let Notifications = null;
if (!isWeb) {
  try {
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (e) {
    console.warn('expo-notifications 不可用（Web 环境）');
  }
}

/** 请求通知权限 */
export async function requestNotificationPermission() {
  if (!Notifications) return false;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('通知权限未授予');
      return false;
    }

    // Android 需要通知渠道
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: '默认通知',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });

      await Notifications.setNotificationChannelAsync('course', {
        name: '课程提醒',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });

      await Notifications.setNotificationChannelAsync('task', {
        name: '任务提醒',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });

      await Notifications.setNotificationChannelAsync('habit', {
        name: '打卡提醒',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    return true;
  } catch (err) {
    console.warn('请求通知权限失败:', err);
    return false;
  }
}

/** 取消所有已计划的通知 */
export async function cancelAllNotifications() {
  if (!Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    console.warn('取消通知失败:', err);
  }
}

/** 取消指定标签的通知 */
export async function cancelNotificationsByTag(tag) {
  if (!Notifications) return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.data?.tag === tag) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch (err) {
    console.warn('取消标签通知失败:', err);
  }
}

/**
 * 为任务设置 DDL 提醒
 * 在截止日期当天早上 8 点提醒，如果已过则不设置
 */
export async function scheduleTaskReminder(task) {
  if (!Notifications) return;
  if (!task.ddl) return;

  try {
    // 先取消该任务的旧提醒
    await cancelNotificationsByTag(`task-${task.id}`);

    const ddlDate = new Date(task.ddl);
    const now = new Date();

    // 设置截止日当天早上 8:00 的提醒
    const reminderDate = new Date(ddlDate);
    reminderDate.setHours(8, 0, 0, 0);

    // 如果提醒时间已过，不设置
    if (reminderDate <= now) return;

    const trigger = {
      type: 'date',
      date: reminderDate,
    };

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '任务即将到期',
        body: `「${task.title}」今天截止！`,
        data: { tag: `task-${task.id}`, taskId: task.id, type: 'task' },
        ...(Platform.OS === 'android' && { channelId: 'task' }),
      },
      trigger,
    });

    // 如果截止日超过 1 天，提前一天也提醒
    const dayBefore = new Date(ddlDate);
    dayBefore.setDate(dayBefore.getDate() - 1);
    dayBefore.setHours(20, 0, 0, 0);

    if (dayBefore > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '任务提醒',
          body: `「${task.title}」明天截止`,
          data: { tag: `task-${task.id}-pre`, taskId: task.id, type: 'task' },
          ...(Platform.OS === 'android' && { channelId: 'task' }),
        },
        trigger: {
          type: 'date',
          date: dayBefore,
        },
      });
    }
  } catch (err) {
    console.warn('设置任务提醒失败:', err);
  }
}

/**
 * 为课程设置上课提醒
 * 在上课前 N 分钟提醒
 */
export async function scheduleCourseReminder(course, remindMinutesBefore = 15) {
  if (!Notifications) return;
  try {
    // 先取消该课程的旧提醒
    await cancelNotificationsByTag(`course-${course.id}`);

    if (!remindMinutesBefore || remindMinutesBefore <= 0) return;

    const now = new Date();
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();

    // 计算下一次上课时间
    const [startHour, startMin] = course.startTime.split(':').map(Number);
    let daysUntil = course.dayOfWeek - dayOfWeek;
    if (daysUntil < 0) daysUntil += 7;
    if (daysUntil === 0) {
      // 今天，检查是否已过上课时间
      const todayClass = new Date();
      todayClass.setHours(startHour, startMin, 0, 0);
      if (todayClass <= now) daysUntil = 7; // 今天已过，安排下周
    }

    const classDate = new Date();
    classDate.setDate(classDate.getDate() + daysUntil);
    classDate.setHours(startHour, startMin - remindMinutesBefore, 0, 0);

    if (classDate <= now) return;

    const trigger = {
      type: 'date',
      date: classDate,
    };

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '上课提醒',
        body: `${course.title} ${course.startTime} @${course.location || '未设置地点'}`,
        data: { tag: `course-${course.id}`, courseId: course.id, type: 'course' },
        ...(Platform.OS === 'android' && { channelId: 'course' }),
      },
      trigger,
    });
  } catch (err) {
    console.warn('设置课程提醒失败:', err);
  }
}

/**
 * 为打卡习惯设置每日提醒
 */
export async function scheduleHabitReminder(habit) {
  if (!Notifications) return;
  try {
    // 先取消该习惯的旧提醒
    await cancelNotificationsByTag(`habit-${habit.id}`);

    if (!habit.time) return;

    const [hour, min] = habit.time.split(':').map(Number);
    if (isNaN(hour) || isNaN(min)) return;

    const trigger = {
      type: 'daily',
      hour,
      minute: min,
    };

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔥 打卡提醒',
        body: `该「${habit.name}」啦！坚持就是胜利 💪`,
        data: { tag: `habit-${habit.id}`, habitId: habit.id, type: 'habit' },
        ...(Platform.OS === 'android' && { channelId: 'habit' }),
      },
      trigger,
    });
  } catch (err) {
    console.warn('设置打卡提醒失败:', err);
  }
}

/** 批量重新调度所有通知（App 启动时调用） */
export async function rescheduleAllNotifications(tasks, courses, habits, settings) {
  if (!Notifications) return;
  if (!settings.notificationsEnabled) {
    await cancelAllNotifications();
    return;
  }

  // 为未完成的任务设置提醒
  const activeTasks = tasks.filter((t) => !t.done && !t.deleted);
  for (const task of activeTasks) {
    await scheduleTaskReminder(task);
  }

  // 为课程设置提醒
  for (const course of courses) {
    await scheduleCourseReminder(course, 15);
  }

  // 为习惯设置提醒（只在习惯今天应出现时才调度本地通知）
  const today = new Date();
  for (const habit of habits) {
    if (isHabitActiveOnDate(habit, today)) {
      await scheduleHabitReminder(habit);
    }
  }
}
