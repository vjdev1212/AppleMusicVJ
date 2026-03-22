import { useColorScheme } from 'react-native';
import { useSettingsStore } from '../store/store_index';
import { Colors } from '../constants/theme';

export const useTheme = () => {
  const systemColorScheme = useColorScheme();
  const { theme } = useSettingsStore();

  const isDark = theme === 'system' 
    ? systemColorScheme === 'dark' 
    : theme === 'dark';

  const colors = isDark ? Colors.dark : Colors.light;

  return {
    isDark,
    colors,
    theme,
  };
};
