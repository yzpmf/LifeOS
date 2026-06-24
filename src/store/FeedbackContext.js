// ============================================================
//  Life OS — 全局反馈（Toast 提示 + 确认弹窗）
//  任意页面通过 useFeedback() 调用：
//    showToast(message, type?, action?)  // type: success|error|info
//    confirm({ title, message, confirmText, destructive }) -> Promise<boolean>
// ============================================================
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import Toast from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

const FeedbackContext = createContext(null);

export function FeedbackProvider({ children }) {
  const [toast, setToast] = useState(null); // { message, type, action, id }
  const [confirmState, setConfirmState] = useState(null); // { ...opts, resolve }
  const toastTimer = useRef(null);

  const hideToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  const showToast = useCallback((message, type = 'success', action = null) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type, action, id: Date.now() });
    // 带「撤销」等操作时停留久一点
    toastTimer.current = setTimeout(() => setToast(null), action ? 4000 : 2200);
  }, []);

  const confirm = useCallback((opts) => {
    return new Promise((resolve) => {
      setConfirmState({ ...opts, resolve });
    });
  }, []);

  const closeConfirm = useCallback((result) => {
    setConfirmState((cur) => {
      cur?.resolve?.(result);
      return null;
    });
  }, []);

  const value = React.useMemo(() => ({ showToast, confirm }), [showToast, confirm]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <ConfirmDialog
        visible={!!confirmState}
        title={confirmState?.title}
        message={confirmState?.message}
        confirmText={confirmState?.confirmText}
        cancelText={confirmState?.cancelText}
        destructive={confirmState?.destructive}
        onConfirm={() => closeConfirm(true)}
        onCancel={() => closeConfirm(false)}
      />
      <Toast toast={toast} onHide={hideToast} />
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used within FeedbackProvider');
  return ctx;
}
