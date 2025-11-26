export interface Base {
    docente: string;
    titular: string;
    departamento: string;
    subdireccion?: string;
    claveDocumento?: string;
}

/**
 * Interfaz para:
 *  * DOC033 - Comisión por asesoría en concursos
 *  * DOC034 - Constancia por asesoría en concursos
 *  * DOC035 - Comisión por asesoría en proyectos premiados en concurso
 *  * DOC036 - Constancia por asesoría en proyectos premiados en concurso
 */
export interface AsesoriaConcuros extends Base {
    evento?: string | null;
    fechaInicio?: Date | null;
    fechaFin?: Date | null;
    ubicacion?: string | null;
    nombreProyecto?: string | null;
    lugarPremiado?: string | null;
}

/**
 * Interfaz para:
 *  * DOC037 - Comisión por colaboración en eventos
 *  * DOC038 - Constancia por colaboración en eventos
 */
export interface ColaboracionEventos extends Base {
    evento?: string | null;
    funcion?: string | null;
    actividades?: string | null;
    fechaInicio?: Date | null;
    fechaFin?: Date | null;
}

/**
 * Interfaz para:
 *  * DOC039 - Comisión para participar como jurado en eventos
 *  * DOC040 - Constancia por participar como jurado en eventos
 */
export interface JuradoEventos extends Base {
    evento?: string | null;
    ubicación?: string | null;
    categoria?: string | null;
    fechaInicio?: Date | null;
    fechaFin?: Date | null;
}

/**
 * Interfaz para:
 *  * DOC041 - Comisión para participar en comités de evaluación
 *  * DOC042 - Constancia por participación en comités de evaluación
 */
export interface ComitesEvaluacion extends Base {
    comite?: string | null;
    tipo?: string | null;
    organismo?: string | null;
}

/**
 * Interfaz para:
 *  * DOC043 - Comisión para auditorías
 *  * DOC044 - Constancia por auditorías
 */
export interface Auditorias extends Base {
    sistema?: string | null;
    funcion?: string | null;
    ubicacion?: string | null;
    fechaInicio?: Date | null;
    fechaFin?: Date | null;
}

/**
 * Interfaz para:
 *  * DOC045 - Comisión para elaboración de planes y programas
 *  * DOC046 - Constancia por elaboración de planes y programas (local)
 *  * DOC047 - Constancia por elaboración de planes y programas (nacional)
 *  * DOC048 - Comisión para la elaboración de módulos de especialidad
 *  * DOC049 - Registro de modulos de especialidad
 *  * DOC050 - Constancia por la elaboracion de modulos de especialidad
 *  * DOC051 - Comisión para la apertura de programas
 *  * DOC052 - Constancia por la apertura de programas
 *  * DOC053 - Autorización para la apertura de programas
 */
export interface DesarrolloCurricular extends Base {
    programa?: string | null;
    clavePrograma?: string | null;
    modalidad?: string | null;
    modulos?: string | null;
    nivelGrado?: string | null;
    listaDocentes?: string | null;
    fechaInicio?: Date | null;
    fechaFin?: Date | null;
}

/**
 * Interfaz para:
 *  * DOC054 - Constancia de prestación de servicios docentes
 *  * DOC055 - Carta de exclusividad laboral
 */
export interface PrestacionServicios extends Base {
    rfc: string | null;
    fechaIngreso?: Date | null;
    clavePresupuestal: string | null;
    estatus?: string | null;
    cargaHoraria?: string | null;
    categoria?: string | null;
    plaza?: string | null;
}

/**
 * Interfaz para:
 *  * DOC056 - Constancia de proyecto de investigación vigente
 */
export interface ProyectoInvestigacion extends Base {
    proyecto?: string | null;
    descripcion?: string | null;
    direccion?: string | null;
}

/**
 * Interfaz para:
 *  * DOC057 - Curriculum vitae actualizado
 */
export interface CurriculumVitae extends Base {
    estado: string | null;
}

/**
 * Interfaz para:
 *  * DOC058 - Autorización de licencias especiales
 */
export interface LicenciasEspeciales extends Base {
    tipoLicencia?: string | null;
    claveOficioAutorizacion?: string | null;
    fechaInicio?: Date | null;
    fechaFin?: Date | null;
}

/**
 * Interfaz para:
 *  * DOC059 - Constancia de cumplimiento de actividades
 *  * DOC060 - Carta de liberación de actividades
 */
export interface CumplimientoActividades extends Base {
    año?: number | null;
    semestre?: string | null;
    estado?: string | null;
}

/**
 * Interfaz para:
 *  * DOC061 - Evaluación departamental nivel licenciatura
 *  * DOC062 - Evaluación departamental nivel posgrado
 *  * DOC063 - Evaluación de desempeño docente
 */
export interface Evaluaciones extends Base {
    año?: number | null;
    semestre?: string | null;
    calificacion?: string | null;
    porcentajeEstudiantado?: number | null;
}

export type DocumentoGenerado = 
    | AsesoriaConcuros
    | ColaboracionEventos
    | JuradoEventos
    | ComitesEvaluacion
    | Auditorias
    | DesarrolloCurricular
    | PrestacionServicios
    | ProyectoInvestigacion
    | CurriculumVitae
    | LicenciasEspeciales
    | CumplimientoActividades
    | Evaluaciones;