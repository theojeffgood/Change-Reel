#!/usr/bin/env node

/**
 * Custom Startup Script for Wins Column
 * 
 * This script starts the Next.js server and then triggers job system initialization
 * via HTTP request to the status API endpoint.
 */

const { spawn } = require('child_process');
const http = require('http');

async function waitForServer(port = 3001, maxAttempts = 30) {
  console.log('🔍 [Startup] Waiting for Next.js server to be ready...');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: 'localhost',
          port: port,
          path: '/api/health',
          method: 'GET',
          timeout: 1000
        }, (res) => {
          if (res.statusCode === 200) {
            resolve(true);
          } else {
            reject(new Error(`Server responded with status ${res.statusCode}`));
          }
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
        
        req.end();
      });
      
      console.log('✅ [Startup] Next.js server is ready');
      return true;
    } catch (error) {
      if (attempt === maxAttempts) {
        console.error('❌ [Startup] Server failed to become ready:', error.message);
        return false;
      }
      // Wait 1 second before next attempt
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return false;
}

async function initializeJobSystemViaAPI() {
  console.log('🚀 [Startup] Initializing job processing system via API...');
  
  try {
    const response = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3001,
        path: '/api/jobs/status',
        method: 'GET',
        timeout: 10000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve({ statusCode: res.statusCode, data: result });
          } catch (err) {
            reject(new Error(`Failed to parse response: ${err.message}`));
          }
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.end();
    });
    
    if (response.data.running) {
      console.log('✅ [Startup] Job processing system started successfully');
      console.log(`📊 [Startup] Active jobs: ${response.data.active_job_count}`);
      return true;
    } else {
      console.log('⚠️  [Startup] Job processing system not running:', response.data.message);
      return false;
    }
  } catch (error) {
    console.error('❌ [Startup] Failed to initialize job system via API:', error.message);
    return false;
  }
}

async function startServer() {
  console.log('🚀 [Startup] Starting Next.js server...');
  
  // Start the Next.js server
  const server = spawn('node', ['server.js'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'production',
      NEXT_RUNTIME: 'nodejs'
    }
  });

  // Handle server process events
  server.on('error', (error) => {
    console.error('❌ [Startup] Failed to start server:', error);
    process.exit(1);
  });

  server.on('exit', (code) => {
    console.log(`[Startup] Server exited with code ${code}`);
    process.exit(code);
  });

  // Handle process signals
  process.on('SIGTERM', () => {
    console.log('🛑 [Startup] Received SIGTERM, shutting down gracefully...');
    server.kill('SIGTERM');
  });

  process.on('SIGINT', () => {
    console.log('🛑 [Startup] Received SIGINT, shutting down gracefully...');
    server.kill('SIGINT');
  });
  
  return server;
}

async function main() {
  console.log('🚀 [Startup] Starting Wins Column application...');
  console.log('🔍 [Startup] Environment:', process.env.NODE_ENV);
  console.log('🔍 [Startup] NEXT_RUNTIME:', process.env.NEXT_RUNTIME);
  
  try {
    // Start the Next.js server
    const server = await startServer();
    
    // Wait for server to be ready
    const serverReady = await waitForServer();
    
    if (!serverReady) {
      console.error('❌ [Startup] Server failed to start properly');
      process.exit(1);
    }
    
    // Initialize job processing system via API
    const jobSystemInitialized = await initializeJobSystemViaAPI();
    
    if (jobSystemInitialized) {
      console.log('✅ [Startup] Complete - Application ready with job processing');
    } else {
      console.log('⚠️  [Startup] Application ready but job processing unavailable');
    }
    
  } catch (error) {
    console.error('❌ [Startup] Failed to start application:', error);
    process.exit(1);
  }
}

// Run the startup sequence
main().catch((error) => {
  console.error('❌ [Startup] Unhandled error:', error);
  process.exit(1);
}); 