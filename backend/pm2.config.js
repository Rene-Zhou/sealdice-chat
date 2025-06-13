module.exports = {
  apps: [
    {
      name: 'seal-dice-chatbot',
      script: 'uvicorn',
      args: 'main:app --host 0.0.0.0 --port 1478',
      interpreter: 'python3',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PYTHONPATH: '.',
      },
      env_production: {
        NODE_ENV: 'production',
        PYTHONPATH: '.',
      },
      log_file: './logs/app.log',
      out_file: './logs/app-out.log',
      error_file: './logs/app-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}; 