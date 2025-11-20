export interface TokenPayload {
  correo: string;
  sub: number; // ClaveUsuario
  claveUsuario: number;
  rol: string;
  claveDepartamento?: number;
  claveDocente?: number;
  iat?: number;
  exp?: number;
  [key: string]: any; // Esto permite propiedades adicionales que JWT podría necesitar
}