export interface Requirement {
  name: string;
  value: boolean;
}

export interface ValidationStatus {
  claveUsuario: string;
  claveDocente: string;
  nombreDocente: string;
  totalRequisitos: number;
  requisitosCumplidos: number;
  porcentajeCumplimiento: number;
  cumpleTodos: boolean;
  requisitos: Requirement[];
}