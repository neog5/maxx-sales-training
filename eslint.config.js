import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    rules: {
      // Images are user uploads and logos served as-is: OpenNext on Cloudflare has no
      // next/image optimizer configured, so <Image> would add nothing here.
      "@next/next/no-img-element": "off",
    },
  },
  {
    ignores: [".next/**", ".open-next/**", "node_modules/**", "tmp/**", "public/**"],
  },
];

export default config;
