export type Docente = {
    nombreCompleto: string;
    clave: string;
    nombramiento: string;
    fechaIngreso: Date;
    fechaIngresoSEP: Date;
    plaza: string;
    clavePresupuestal: string;
}

export interface Base {
    docente: Docente;
    titular: string;
    departamento: string;
    claveDepartamento: string;
    subdireccion?: string;
    claveDocumento?: string;
}

/**
 * Interfaz para:
 *  * DOC001 - Horarios de asignaturas de licenciatura
 *  * DOC003 - Horarios de asignatura adicional
 *  * DOC005 - Horarios de asignaturas posgrado
 */
export interface Horarios extends Base {
    periodo: string | null;
    asignaturas: AsignaturaDetalle[] | null;
    totalHoras: number | null;
}

export interface AsignaturaDetalle {
    nombre: string | null;
    clave: string | null;
    grupo?: string | null;
    estudiantes: number | null;
    aula?: string | null;
    nivel: string | null;
    modalidad?: string | null;
    horario?: string[] | null;
    horas?: number | null;
    periodo?: string | null;
}

/**
 * Interfaz para:
 *  * DOC002 - Constancia de asignaturas impartidas
 *  * DOC004 - Constancia de séptima asignatura
 *  * DOC006 - Constancia de asignaturas posgrado
 */
export interface ConstanciaAsignaturas extends Base {
    año: number | null;
    asignaturas: AsignaturaDetalle[] | null;
    totalAlumnos: number | null;
}

/**
 * Interfaz para:
 *  * DOC008 - Constancia de tutorías PIT
 */
export interface Tutorias extends Base {
    tutorias: TutoriasDetalle[] | null;
    totalTutorados: number | null;
}

export interface TutoriasDetalle {
    periodo: string | null;
    tutorados: number | null;
    carrera: string | null;
}

/**
 * Interfaz para:
 *  * DOC009 - Constancia de acreditación de programa
 */
export interface AcreditacionPrograma extends Base {
    nombrePrograma: string | null;
    organismoAcreditador: string | null;
    fechaAcreditacion: Date | null;
    fechaVencimiento: Date | null;
    snp: string | null;
}

/**
 * Interfaz para:
 *  * DOC010 - Constancia actividades complementarias
 */
export interface ActividadesComplementarias extends Base {
    nombreActividad: string | null;
    dictamen: string | null;
    creditos: number | null;
    estudiantes: number | null;
}

/**
 * Interfaz para:
 *  * DOC011 - Constancia proyecto integrador
 */
export interface ProyectoIntegrador extends Base {
    nombreProyecto: string | null;
    asignaturas: string | null;
}

/**
 * Interfaz para:
 *  * DOC012 - Constancia manual de prácticas
 *  * DOC013 - Constancia estrategias didácticas
 *  * DOC014 - Constancia materiales didácticos inclusivos
 */
export interface ElaboracionMaterial extends Base {
    nombre?: string | null;
    asignatura?: string | null;
    productos?: string | null;
    descripcionImpacto?: string | null;
    enfoque?: string | null;
}

/**
 * Interfaz para:
 *  * DOC015 - Comisión por instructor de cursos para docentes
 *  * DOC016 - Constancia por curso impartido
 *  * DOC017 - Comisión por instructor de cursos TECNM
 *  * DOC018 - Constancia por curso impartido TECNM
 */
export interface CursosImpartidos extends Base {
    nombreCurso?: string | null;
    tipoCurso?: string | null;
    duracion?: number | null;
    fechaInicio?: Date | null;
    fechaFin?: Date | null;
    numeroRegistro?: string | null;
    docentesBeneficiados?: number | null;
}

/**
 * Interfaz para:
 *  * DOC019 - Comisión por diplomado pensamiento crítico
 *  * DOC020 - Constancia diplomado pensamiento crítico
 *  * DOC021 - Constancia diplomado formación de tutores
 *  * DOC022 - Oficio diplomado recursos educativos
 *  * DOC023 - Constancia diplomado recursos educativos
 *  * DOC024 - Comisión diplomado educación inclusiva
 *  * DOC025 - Constancia diplomado educación inclusiva
 */
export interface Diplomados extends Base {
    nombreDiplomado?: string | null;
    nombreModulo?: string | null;
    duracionHoras?: number | null;
}

/**
 * Interfaz para:
 *  * DOC026 - Comisión diplomados estratégicos
 *  * DOC027 - Constancia diplomados estratégicos
 */
export interface DiplomadosEstrategicos extends Base {
    nombreDiplomado: string | null;
    duracionHoras?: number | null;
    nombreProyectoEstrategico: string | null;
}

/**
 * Interfaz para:
 *  * DOC028 - Acta examen profesional/grado
 *  * DOC030 - Constancia sinodal titulación
 */
export type Alumno = {
    nombreCompleto: string;
    numeroControl: string;
}

export interface Titulacion extends Base {
    alumno: Alumno;
    fechaExamen?: Date | null;
    programaEducativo?: string | null;
    rolDocente?: string | null;
    folioActa?: string | null;
    vocal?: string | null;
    secretario?: string | null;
}

/**
 * Interfaz para:
 *  * DOC029 - Convenio de colaboración académica
 */
export interface ConvenioColaboracion extends Base {
    institucion1?: string | null;
    institucion2?: string | null;
    tipoConvenio?: string | null;
    rolDocente?: string | null;
}

/**
 * Interfaz para:
 *  * DOC031 - Programa de asesorías en ciencias básicas
 */
export interface ProgramaCienciasBasicas extends Base {
    asesorias: AsesoriaDetalle[] | null;
    año: number | null;
}

export interface AsesoriaDetalle {
    horario: string | null;
    asignatura: string | null;
    modalidad: string | null;
    periodo: string | null;
}

/**
 * Interfaz para:
 *  * DOC032 - Constancia de asesorías en ciencias básicas
 */
export interface ConstanciaCienciasBasicas extends Base {
    totalHoras: number | null;
    periodo: string | null;
    totalEstudiantes: number | null;
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

export type GeneratedFile = 
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
    | Evaluaciones
    | Horarios
    | ConstanciaAsignaturas
    | Tutorias
    | AcreditacionPrograma
    | ActividadesComplementarias
    | ProyectoIntegrador
    | ElaboracionMaterial
    | CursosImpartidos
    | Diplomados
    | Titulacion
    | ConvenioColaboracion
    | ProgramaCienciasBasicas
    | ConstanciaCienciasBasicas;