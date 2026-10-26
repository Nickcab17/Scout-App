import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [...nextVitals, { ignores: [".next/**", ".next-e2e/**", "node_modules/**", "test-results/**", "playwright-report/**"] }];
export default eslintConfig;
