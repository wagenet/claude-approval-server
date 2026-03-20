export default {
  extends: ['stylelint-config-standard'],
  rules: {
    // False positives for semantically-unrelated rules sharing tag-type selectors
    'no-descending-specificity': null,
  },
};
