import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  divider: css`
    height: 24px;
  `,

  // Inner container - uses CSS variables that adapt to light/dark automatically
  innerContainer: css`
    position: relative;

    overflow: hidden;

    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadius};

    background: ${cssVar.colorBgContainer};
  `,

  // Outer container
  outerContainer: css`
    position: relative;
  `,
}));
