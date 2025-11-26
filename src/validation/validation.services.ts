import { Injectable } from "@nestjs/common";
import { MssqlService } from '@strongnguyen/nestjs-mssql';
import { DynamicDatabaseService } from '../database/dynamic-database.service';
import { FilesService } from "../files/files.service";

interface Requisito {
    name: string;
    value: boolean;
}

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
    ): Promise<Requisito[]> {
        const resultados: Requisito[] = [];
        // implementación

        return resultados;
    }

    /*
     *  Constancia de Recursos Humanos que especifique el nombramiento de tiempo completo en estatus 10 o 95
     *  sin titular, a partir de la quincena 01 del {año}, y que no ha sido acreedor a algún tipo de sanción, habiendo
     *  cumplido con al menos el 90% de asistencia de acuerdo con su jornada y horario de trabajo durante el
     *  período a evaluar.
     */
    async recursosHumanos(
        claveDocente: string,
        año: number,
    ): Promise<Record<string, boolean>[]> {
        const results: Record<string, boolean>[] = [];
        const claveDepartamento = ''; 

        const nombramiento = await this.dynamicDatabaseService.executeQueryByDepartmentId(
            claveDepartamento,
            `SELECT 
                Estado as estado,
                Fecha as fechaIngreso,
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

        results.push({
            'Nombramiento tiempo completo (estatus 10 o 95)': 
                (nombramiento[0]?.cargaHoraria === 'TIEMPO COMPLETO') && 
                (nombramiento[0]?.estado === '10' || nombramiento[0]?.estado === '95'),
            'Sin sanciones': sanciones[0]?.totalSanciones === 0,
            'Asistencia >= 90%': (asistencia[0]?.asistencias) >= 0.9 * 170 // asumiendo 170 días laborables al año
        });

        return results;
    }

    /**
     * Horarios de labores del periodo a evaluar {año} y del primer semestre del año actual. Cumplir con la carga
     * académica reglamentaria
     */
    async cargaReglamentaria(
        claveDocente: string,
        añoActual: number,
        añoEvaluar: number,
    ): Promise<Requisito> {
        const claveDepartamento = '';

        const carga = await this.dynamicDatabaseService.executeQueryByDepartmentId(
            claveDepartamento,
            `SELECT 
                SUM(Horas) as total,
                SEMESTRE,
                AÑO   
            FROM (
                SELECT 
                    CASE
                        WHEN g.horario LIKE '%LUN-VIE%' THEN 5
                        WHEN g.horario LIKE '%LUN-JUE%' THEN 4
                        ELSE 0
                    END AS Horas,
                    g.Semestre,
                    g.Año
                FROM Grupo g
                INNER JOIN Asignatura_Docente ad ON g.ClaveGrupo = ad.ClaveGrupo
                WHERE ad.claveDocente = @ClaveDocente
                    AND (g.Año = @AñoEvaluar or (g.Año = @AñoActual and g.Semestre = 'ENERO-JUNIO'))
                    GROUP BY g.Horario, g.Semestre, g.Año
            ) CargaHoraria
            GROUP BY CargaHoraria.Año, CargaHoraria.Semestre
            ORDER Año, Semestre
            `
        )

        const proyecto = await this.proyectoInvestigacion(claveDocente);

        return {
            name: 'Carga académica reglamentaria cumplida', 
            value: (carga[0]?.total >= 40 && 
                    carga[1]?.total >= 40 && 
                    carga[2]?.total >= 40) || proyecto.value
        };
    }

    /**
     * El personal docente con plaza de profesor investigador, debe presentar un proyecto de investigación vigente 
     *  registrado ante la DDIE del TecNM.  
     */
    async proyectoInvestigacion(
        claveDocente: string,
    ): Promise<Requisito> {
        const claveDepartamento = '';

        const docenteInvestigador = await this.dynamicDatabaseService.executeQueryByDepartmentId(
            claveDepartamento,
            `SELECT 
                Categoria as categoria
            FROM Docente 
            WHERE ClaveDocente = @ClaveDocente,
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
            [{ name: 'ClaveDocente', value: claveDocente }]
        )

        return (docenteInvestigador[0]?.categoria === undefined 
            ? (proyecto.length > 0)
                ? { name: 'Proyecto de investigación vigente', value: true }
                : { name: 'No aplica proyecto de investigación', value: true } 
            : { name: 'Proyecto de investigación vigente', value: proyecto.length > 0 })
    }

    /**
     *  Constancia emitida por la persona titular del Departamento de Desarrollo Académico, que avale que el 
     *  personal docente participante tiene registrado y actualizado el currículum vitae CVU-TecNM. Para ello, el 
     *  personal docente participante debe entregar su CVU-TecNM en extenso a dicho departamento ya sea 
     *  impreso o en electrónico. 
     */
    async curriculumVitae(
        claveDocente: string
    ): Promise<Requisito> {
        const claveDepartamento = '';

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

        return {
            name: 'Currículum vitae actualizado', 
            value: curriculum.length > 0
        }
    }

    /**
     * Constancia emitida por la persona titular del Departamento de Servicios Escolares que indique por semestre, 
     *   el nivel, el nombre y la clave de las asignaturas que impartió, así como la cantidad de estudiantes atendidos 
     *   en cada grupo durante el periodo a evaluar (2024). No se deben considerar asignaturas impartidas en cursos 
     *   de verano. 
     */
}