// ============================================================
//  Life OS — 底部弹窗键盘避让容器
//  解决 Android 上 Modal 内输入框被键盘遮挡的问题：
//  RN 的 <Modal> 在 Android 是独立 window，系统的 adjustResize
//  和原生 KeyboardAvoidingView 都不可靠，这里直接监听键盘事件
//  手动把弹窗抬升到键盘上方（iOS / Android 通用，动画平滑）。
// ============================================================
import React, { useEffect, useState } from 'react';
import { View, Keyboard, Platform, LayoutAnimation, UIManager } from 'react-native';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function KeyboardAvoidingSheet({ style, children }) {
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    // iOS 用 will* 事件更跟手；Android 只有 did* 事件可靠
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKbHeight(e?.endCoordinates?.height ?? 0);
    };
    const onHide = () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKbHeight(0);
    };

    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  // overlay 是 flex:1 + justifyContent:'flex-end'，
  // 给底部加 kbHeight 的 padding 即可把贴底的弹窗整体顶到键盘上方。
  return <View style={[style, { paddingBottom: kbHeight }]}>{children}</View>;
}
