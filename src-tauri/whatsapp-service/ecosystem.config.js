module.exports = {
  apps: [
    {
      name: "pulso-whatsapp-service",
      script: "index.js",
      cwd: "/Users/felipedutra/Projetos/eden-terra/src-tauri/whatsapp-service",
      watch: false,
      env: {
        NODE_ENV: "production",
      }
    }
  ]
};
