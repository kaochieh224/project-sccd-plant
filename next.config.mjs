// 部署到 GitHub Pages 時，網址會是 https://<帳號>.github.io/<repo名稱>/
// BASE_PATH 由 .github/workflows/deploy.yml 自動帶入；本機開發時為空字串。
const basePath = process.env.BASE_PATH || '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
