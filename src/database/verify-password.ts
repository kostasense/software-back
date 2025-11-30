// src/scripts/verify-password.ts
import * as bcrypt from 'bcrypt';
import * as sql from 'mssql';
import * as dotenv from 'dotenv';

dotenv.config();

async function verifyPassword() {
  const email = 'carlos.ramirez@tecnm.mx';
  const passwordToTest = 'pass123';
  
  console.log('=== Verificación de Contraseña ===\n');
  console.log(`Email: ${email}`);
  console.log(`Contraseña a probar: "${passwordToTest}"`);
  console.log(`Longitud: ${passwordToTest.length} caracteres\n`);
  
  // Conectar a la BD
  const connectionUrl = process.env.DATABASE_URL!;
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

  try {
    const pool = await sql.connect(config);
    
    // Obtener el usuario
    const result = await pool.request()
      .input('email', sql.VarChar, email)
      .query(`
        SELECT ClaveUsuario, Correo, Contrasena
        FROM Usuario
        WHERE Correo = @email
      `);
    
    if (result.recordset.length === 0) {
      console.log('❌ Usuario no encontrado');
      return;
    }
    
    const user = result.recordset[0];
    console.log('✅ Usuario encontrado:');
    console.log(`   ClaveUsuario: ${user.ClaveUsuario}`);
    console.log(`   Hash almacenado: ${user.Contrasena}`);
    console.log(`   Longitud del hash: ${user.Contrasena.length}`);
    console.log(`   Es hash bcrypt: ${user.Contrasena.startsWith('$2b$')}\n`);
    
    // Probar diferentes variaciones
    const passwords = [
      passwordToTest,
      passwordToTest.trim(),
      passwordToTest + ' ',
      ' ' + passwordToTest,
      passwordToTest.toLowerCase(),
      passwordToTest.toUpperCase(),
    ];
    
    console.log('🔍 Probando variaciones de la contraseña:');
    for (const pass of passwords) {
      const isValid = await bcrypt.compare(pass, user.Contrasena);
      console.log(`   "${pass}" (longitud: ${pass.length}): ${isValid ? '✅ VÁLIDA' : '❌ INVÁLIDA'}`);
    }
    
    // Generar un nuevo hash para comparar
    console.log('\n🔐 Generando nuevo hash para "pass123":');
    const newHash = await bcrypt.hash('pass123', 10);
    console.log(`   Nuevo hash: ${newHash}`);
    
    // Comparar con el nuevo hash
    const testWithNewHash = await bcrypt.compare('pass123', newHash);
    console.log(`   Prueba con nuevo hash: ${testWithNewHash ? '✅ VÁLIDA' : '❌ INVÁLIDA'}`);
    
    await pool.close();
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Función para actualizar la contraseña con un nuevo hash
async function updatePasswordWithNewHash() {
  const email = 'carlos.ramirez@tecnm.mx';
  const password = 'pass123';
  
  const connectionUrl = process.env.DATABASE_URL!;
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

  const pool = await sql.connect(config);
  
  // Generar nuevo hash
  const newHash = await bcrypt.hash(password, 10);
  console.log('\n=== Actualizando contraseña ===');
  console.log(`Email: ${email}`);
  console.log(`Nuevo hash generado: ${newHash}`);
  
  // Actualizar
  const result = await pool.request()
    .input('email', sql.VarChar, email)
    .input('hash', sql.VarChar, newHash)
    .query(`
      UPDATE Usuario
      SET Contrasena = @hash
      WHERE Correo = @email
    `);
  
  console.log(`✅ Filas actualizadas: ${result.rowsAffected[0]}`);
  
  // Verificar
  const verify = await pool.request()
    .input('email', sql.VarChar, email)
    .query(`SELECT Contrasena FROM Usuario WHERE Correo = @email`);
  
  if (verify.recordset.length > 0) {
    const isValid = await bcrypt.compare(password, verify.recordset[0].Contrasena);
    console.log(`🔍 Verificación después de actualizar: ${isValid ? '✅ VÁLIDA' : '❌ INVÁLIDA'}`);
  }
  
  await pool.close();
}

// Ejecutar verificación
verifyPassword().then(() => {
  // Si quieres actualizar la contraseña, descomenta la siguiente línea:
  // updatePasswordWithNewHash();
});