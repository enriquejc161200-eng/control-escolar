import { StyleSheet } from 'react-native';

const colors = {
  primary: '#0099cc',
  fontLight: '#fff',
  bgDark: '#000',
};

const formStyles = StyleSheet.create({
  input: {
    marginBottom: 20,
  },
  btnSuccess: {
    padding: 5,
    backgroundColor: colors.primary,
  },
  btnText: {
    marginTop: 10,
  },
});

export default formStyles;
