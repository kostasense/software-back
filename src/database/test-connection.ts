// src/database/test-connection.ts
import * as sql from 'mssql';
import * as dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  const connectionUrl = process.env.DATABASE_URL;
  
  if (!connectionUrl) {
    console.error('DATABASE_URL no está definida');
    return;
  }

  console.log('DATABASE_URL:', connectionUrl.replace(/:[^:@]+@/, ':***@'));
  
  try {
    const url = new URL(connectionUrl);
    
    const config: sql.config = {
      server: url.hostname,
      port: parseInt(url.port) || 1433,
      user: url.username,
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
    };

    console.log('Conectando a:', config.server + ':' + config.port);
    console.log('Base de datos:', config.database);
    console.log('Usuario:', config.user);
    
    const pool = await sql.connect(config);
    console.log('Conexión exitosa!');
    
    const result = await pool.request().query('SELECT 1 as test');
    console.log('Resultado de prueba:', result.recordset);
    
    await pool.close();
  } catch (error) {
    console.error('Error de conexión:', error);
  }
}

testConnection();