import { Injectable } from "@nestjs/common";
import { MssqlService } from '@strongnguyen/nestjs-mssql';
import { DynamicDatabaseService } from '../database/dynamic-database.service';
import { FilesService } from "../files/files.service";
import { Requirement } from "./interfaces/validation.interface";

type Validation = (
    claveDocente: string,
    claveDepartamento: string,
    año: number
) => Promise<Requirement[]>;

@Injectable()
export class ValidationServices {
    constructor(
        private readonly mssql: MssqlService,
        private readonly filesService: FilesService,
        private readonly dynamicDatabaseService: DynamicDatabaseService,
    ) {}

    /**
     * Validación de requisitos iniciales
     * @param claveDocente 
     */
    async requisitosIniciales(
        claveDocente: string
    ): Promise<Requirement[]> {

        const añoEvaluar = new Date().getFullYear() - 1;

        // Obtener clave de departamentos
        const academia = await this.filesService.getDepartmentByProfessorId(claveDocente);
        const recursosHumanos = await this.filesService.getDepartmentIdByName('RECURSOS HUMANOS');
        const docencia = await this.filesService.getDepartmentIdByName('DIRECCIÓN DE DOCENCIA');
        const desarrolloAcademico = await this.filesService.getDepartmentIdByName('DESARROLLO ACADÉMICO');


        // Verificar asignaturas posgrado en los dos semestres
        const checkFirstSemester = await this.filesService.checkCourses(claveDocente, academia, añoEvaluar, 'ENERO-JUNIO');
        const checkSecondSemester = await this.filesService.checkCourses(claveDocente, academia, añoEvaluar, 'AGOSTO-DICIEMBRE');
        
        let departamentoPosgrado: string | null = null;
        let departamentoAcademia: string | null = null;

        departamentoPosgrado = checkFirstSemester || checkSecondSemester
            ? await this.filesService.getDepartmentIdByName('posgrado') : null;
        
        departamentoAcademia = !checkFirstSemester || !checkSecondSemester
            ? academia : null;

        const validation: Record<number, Validation> = {
            0: this.recursosHumanos.bind(this),
            1: this.cargaReglamentaria.bind(this),
            2: this.proyectoInvestigacion.bind(this),
            3: this.curriculumVitae.bind(this),
            4: this.actividadesDocentes.bind(this),
            5: this.evaluacionesDepartamentales.bind(this),
            6: this.evaluacionesDepartamentales.bind(this),
            7: this.evaluacionesGrupo.bind(this)
        };

        const departamentos = [recursosHumanos, 
                               academia, 
                               docencia, 
                               desarrolloAcademico, 
                               academia, 
                               departamentoAcademia,
                               departamentoPosgrado, 
                               desarrolloAcademico];

        const requeriments: Requirement[] = [];
        for (const key in validation) {
            const dept = departamentos[key];
            if (dept) {
                const result = await validation[key](claveDocente, dept, añoEvaluar);
                requeriments.push(...result);
            }
        }

        return requeriments;
    }

    /*
     *  Constancia de Recursos Humanos que especifique el nombramiento de tiempo completo en estatus 10 o 95
     *  sin titular, a partir de la quincena 01 del {año}, y que no ha sido acreedor a algún tipo de sanción, habiendo
     *  cumplido con al menos el 90% de asistencia de acuerdo con su jornada y horario de trabajo durante el
     *  período a evaluar.
     */
    async recursosHumanos(
        claveDocente: string,
        claveDepartamento: string,
        año: number,
    ): Promise<Requirement[]> {

        const nombramiento = await this.dynamicDatabaseService.executeQueryByDepartmentId(
            claveDepartamento,
            `SELECT 
                Estatus as estado,
                FechaIngreso as fechaIngreso,
                CargaHoraria as cargaHoraria
            FROM Docente
            WHERE ClaveDocente = @ClaveDocente`,
            [{ name: 'ClaveDocente', value: claveDocente }]
        )

        const sanciones = await this.dynamicDatabaseService.executeQueryByDepartmentId(
            claveDepartamento,
            `SELECT 
                COUNT(*) as totalSanciones
            FROM Sancion
            WHERE ClaveDocente = @ClaveDocente`,
            [{ name: 'ClaveDocente', value: claveDocente }]
        )

        const asistencia = await this.dynamicDatabaseService.executeQueryByDepartmentId(
            claveDepartamento,
            `SELECT
                SUM(Asistencias + Justificadas) as asistencias
            FROM Asistencia
            WHERE ClaveDocente = @ClaveDocente 
                AND Año = @Año`,
            [{ name: 'ClaveDocente', value: claveDocente },
             { name: 'Año', value: año }]
        )

        return [
            {name: 'Nombramiento tiempo completo (estatus 10 o 95)', value: (nombramiento[0]?.cargaHoraria === 'TIEMPO COMPLETO') && 
                                                                            (nombramiento[0]?.estado === '10' || nombramiento[0]?.estado === '95')},
            { name: 'Sin sanciones', value: sanciones[0]?.totalSanciones === 0},
            { name: 'Asistencia >= 90%', value: (asistencia[0]?.asistencias) >= 0.9 * 170 } // asumiendo 170 días laborables al año
        ];
    }

    /**
     * Horarios de labores del periodo a evaluar {año} y del primer semestre del año actual. Cumplir con la carga
     * académica reglamentaria
     */
    async cargaReglamentaria(
        claveDocente: string,
        claveDepartamento: string,
        año: number
    ): Promise<Requirement[]> {

        const carga = await this.dynamicDatabaseService.executeQueryByDepartmentId(
            claveDepartamento,
           `SELECT 
                SUM(
                    CASE
                        WHEN g.Horario LIKE '%LUN-VIE%' THEN 5
                        WHEN g.Horario LIKE '%LUN-JUE%' THEN 4
                    END
                ) AS total
            FROM Asignatura_Docente ad
            INNER JOIN Grupo g 
                ON ad.ClaveGrupo = g.ClaveGrupo 
                AND ad.Año = g.Año 
                AND ad.Semestre = g.Semestre
            WHERE ad.ClaveDocente = @ClaveDocente
                AND (
                    ad.Año = @AñoEvaluar 
                    OR (ad.Año = @AñoActual AND ad.Semestre = 'ENERO-JUNIO')
                )
            GROUP BY ad.Año, ad.Semestre
            ORDER BY ad.Año, ad.Semestre`,
            [{ name: 'ClaveDocente', value: claveDocente },
             { name: 'AñoEvaluar', value: año },
             { name: 'AñoActual', value: new Date().getFullYear() }]
        )

        const proyecto = await this.proyectoInvestigacion(claveDocente, 'DDIRD09', año);

        return [{
            name: 'Carga académica reglamentaria cumplida', 
            value: (carga[0]?.total >= 40 && 
                    carga[1]?.total >= 40 && 
                    carga[2]?.total >= 40) || proyecto[0].value
        }];
    }

    /**
     *  El personal docente con plaza de profesor investigador, debe presentar un proyecto de investigación vigente 
     *  registrado ante la DDIE del TecNM.  
     */
    async proyectoInvestigacion(
        claveDocente: string,
        claveDepartamento: string,
        año: number
    ): Promise<Requirement[]> {

        const docenteInvestigador = await this.dynamicDatabaseService.executeQueryByDepartmentId(
            'DRRHH07',
            `SELECT 
                Categoria as categoria
            FROM Docente 
            WHERE ClaveDocente = @ClaveDocente
                AND Categoria LIKE '%INVESTIGADOR%'`,
            [{ name: 'ClaveDocente', value: claveDocente }]
        )

        const proyecto = await this.dynamicDatabaseService.executeQueryByDepartmentId(
            claveDepartamento,
            `SELECT 
                pi.NombreProyecto AS nombreProyecto,
                pi.Descripcion AS descripcion
            FROM ProyectoInvestigacion pi 
            WHERE pi.ClaveDocente = @ClaveDocente
                AND Año = @Año`,
            [{ name: 'ClaveDocente', value: claveDocente },
             { name: 'Año', value: año + 1 }]
        )

        return ([
            docenteInvestigador[0]?.categoria === undefined 
            ? (proyecto.length > 0)
                ? { name: 'Proyecto de investigación vigente', value: true }
                : { name: 'No aplica proyecto de investigación', value: true } 
            : { name: 'Proyecto de investigación vigente', value: proyecto.length > 0 }
        ]);
    }

    /**
     *  Constancia emitida por la persona titular del Departamento de Desarrollo Académico, que avale que el 
     *  personal docente participante tiene registrado y actualizado el currículum vitae CVU-TecNM. Para ello, el 
     *  personal docente participante debe entregar su CVU-TecNM en extenso a dicho departamento ya sea 
     *  impreso o en electrónico. 
     */
    async curriculumVitae(
        claveDocente: string,
        claveDepartamento: string
    ): Promise<Requirement[]> {

        const curriculum = await this.dynamicDatabaseService.executeQueryByDepartmentId(
            claveDepartamento,
            `SELECT
                d.CVUEstado AS estado
            FROM Docente d
            WHERE d.ClaveDocente = @ClaveDocente
                AND d.CVUEstado = 'VIGENTE'
            `,
            [{ name: 'ClaveDocente', value: claveDocente }]
        )

        return [{
            name: 'Currículum vitae actualizado', 
            value: curriculum.length > 0
        }];
    }
    
    /**
     *  * Constancias de cumplimiento de las actividades docentes encomendadas en tiempo y forma mediante el
     *  formato de liberación de actividades, de los dos semestres del periodo a evaluar.
     *  Donde se especifique que el personal docente está LIBERADO(A).
     * 
     *  * Carta de liberación de actividades académicas debidamente requisitada, donde se indique que las 
     *  actividades encomendadas fueron cumplidas al 100%.
     */
    async actividadesDocentes(
        claveDocente: string,
        claveDepartamento: string,
        año: number
    ): Promise<Requirement[]> {

        const actividades = await this.dynamicDatabaseService.executeQueryByDepartmentId(
            claveDepartamento,
            `SELECT 
                Año as año,
                Semestre as semestre,
                CASE 
                WHEN COUNT(*) = SUM(Estado)
                    THEN 'LIBERADO'
                    ELSE 'NO LIBERADO'
                END AS estado
            FROM Asignatura_Docente
            WHERE ClaveDocente = @ClaveDocente
                AND Año = @Año
            GROUP BY 
                Año,
                Semestre`,
            [{ name: 'ClaveDocente', value: claveDocente },
             { name: 'Año', value: año }]
        )

        return [{
            name: 'Actividades docentes liberadas en tiempo y forma', 
            value: actividades.length === 2 && actividades.every(act => act.estado === 'LIBERADO')
        }];
    }

    /**
     *  Evaluaciones departamentales del periodo a evaluar con una calificación global mínima de SUFICIENTE. 
     *  Para el caso de personal docente que únicamente atendió grupos de Posgrado deberá presentar una evaluación 
     *  instrumentada por la propia institución con una calificación global mínima de SUFICIENTE.
     */
    async evaluacionesDepartamentales(
        claveDocente: string,
        claveDepartamento: string,
        año: number,
    ): Promise<Requirement[]> {

        const evaluaciones = await this.dynamicDatabaseService.executeQueryByDepartmentId(
            claveDepartamento,
            `SELECT 
                Año AS año,
                Semestre AS semestre,
                Calificacion AS calificacion
            FROM EvaluacionDepartamental
            WHERE ClaveDocente = @ClaveDocente
                AND Año = @Año
                AND Calificacion IN ('SUFICIENTE', 'BUENA', 'SOBRESALIENTE', 'EXCELENTE')`,
            [{ name: 'ClaveDocente', value: claveDocente },
             { name: 'Año', value: año }]
        )

        return [{
            name: 'Evaluaciones departamentales con calificación mínima de SUFICIENTE',
            value: evaluaciones.length > 0
        }];
    }

    /**
     *  Dos evaluaciones del desempeño frente a grupo del periodo a evaluar con una calificación mínima de
     *  SUFICIENTE, las cuales deberán corresponder a la evaluación de al menos el 60% del estudiantado atendido
     *  por el personal docente participante (el porcentaje no aplica para grupos de posgrado)
     */
    async evaluacionesGrupo(
        claveDocente: string,
        claveDepartamento: string,
        año: number,
    ): Promise<Requirement[]> {

        const evaluaciones = await this.dynamicDatabaseService.executeQueryByDepartmentId(
            claveDepartamento,
            `SELECT
                Año AS año,
                Semestre AS semestre,
                PorcentajeEstudiantado AS porcentajeEstudiantado
            FROM EvaluacionDesempeño
            WHERE ClaveDocente = @ClaveDocente
                AND Año = @Año
                AND PorcentajeEstudiantado >= 60
                AND Calificacion IN ('SUFICIENTE', 'BUENA', 'SOBRESALIENTE', 'EXCELENTE')`,
            [{ name: 'ClaveDocente', value: claveDocente },
             { name: 'Año', value: año }]
        )

        return [{
            name: 'Evaluaciones frente a grupo con calificación mínima de SUFICIENTE',
            value: evaluaciones.length === 2
        }];
    }
}