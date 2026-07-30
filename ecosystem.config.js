





module.exports = {
  apps: [
    {
      name: 'training-platform-backend',
      script: 'dist/server.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '300M',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
      
      
      
      
      time: true,
    },
  ],
};
