export interface AuthResponse {
  success: boolean;
  statusCode: number;
  message?: string;
  error?: string;
  requiresLogin?: boolean;
  requiresRefresh?: boolean;
  data?: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
    user: {
      claveUsuario: number;
      correo: string;
      rol: string;
      claveDepartamento?: number;
      claveDocente?: number;
    };
  } | null;
}