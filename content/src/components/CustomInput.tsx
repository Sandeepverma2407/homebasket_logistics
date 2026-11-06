import React, { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View, Text, Pressable, StyleProp, ViewStyle, TextStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

interface CustomInputProps extends TextInputProps {
  prefixText?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export default function CustomInput({
  prefixText,
  containerStyle,
  inputStyle,
  secureTextEntry,
  style,
  ...props
}: CustomInputProps) {
  const { colors } = useTheme();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [text, setText] = useState(props.value || props.defaultValue || '');

  React.useEffect(() => {
    if (props.value !== undefined) {
      setText(props.value);
    }
  }, [props.value]);

  const handleChangeText = (val: string) => {
    setText(val);
    if (props.onChangeText) {
      props.onChangeText(val);
    }
  };

  const shouldObscure = secureTextEntry && !isPasswordVisible;
  const currentFontFamily = text.length > 0 ? 'Inter-SemiBold' : 'Inter-Medium';

  return (
    <View style={[
      styles.container,
      { backgroundColor: colors.inputBg, borderColor: colors.border },
      containerStyle
    ]}>
      {prefixText && (
        <View style={styles.prefixContainer}>
          <Text style={[styles.prefixText, { color: colors.textPrimary }]}>{prefixText}</Text>
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
        </View>
      )}

      <TextInput
        style={[styles.input, { fontFamily: currentFontFamily, color: colors.textPrimary }, inputStyle, style]}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={shouldObscure}
        autoCapitalize="none"
        onChangeText={handleChangeText}
        {...props}
      />

      {secureTextEntry && (
        <Pressable
          onPress={() => setIsPasswordVisible(!isPasswordVisible)}
          style={styles.eyeButton}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            {isPasswordVisible ? (
              // Eye open SVG
              <Path
                d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
                fill={colors.textMuted}
              />
            ) : (
              // Eye closed SVG
              <Path
                d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.82l2.92 2.92c1.51-1.26 2.7-2.89 3.44-4.74-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.17c0-1.66-1.34-3-3-3l-.17.02z"
                fill={colors.textMuted}
              />
            )}
          </Svg>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 51,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#bbcabf',
    borderRadius: 16,
    paddingHorizontal: 12,
    // Soft shadow matching figma
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 2,
  },
  prefixContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  prefixText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: '#151c27',
    paddingRight: 8,
  },
  separator: {
    width: 1,
    height: 20,
    backgroundColor: '#bbcabf',
  },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: '#151c27',
    paddingVertical: 0,
  },
  eyeButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
