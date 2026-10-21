import { StyleSheet, Text } from 'react-native';

import { colors } from '../theme';

type Props = {
  message: string;
};

export default function ErrorText({ message }: Props) {
  return <Text style={styles.text}>{message}</Text>;
}

const styles = StyleSheet.create({
  text: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
});
