import { Injectable } from '@nestjs/common';
import { MssqlService } from '@strongnguyen/nestjs-mssql';

@Injectable()
export class ActivitiesService {
    constructor(
        private readonly mssql: MssqlService,
    ) {}

    async getActivityById(claveActividad: string) {
        const pool = this.mssql.getPool();
        const result = await pool
            .request()
            .input('ClaveActividad', claveActividad)
            .query(`SELECT * FROM Actividad WHERE ClaveActividad = @ClaveActividad`);

        return result.recordset || null;
    }

    async getAllActivities() {
        const pool = this.mssql.getPool();
        const result = await pool
            .request()
            .query(`SELECT * FROM Actividad`);

        return result.recordset || null;
    }

    async getActivityByDocumentId(claveDocumento: string) {
        const pool = this.mssql.getPool();
        const result = await pool
            .request()
            .input('ClaveDocumento', claveDocumento)
            .query(`SELECT a.Nombre AS nombreActividad
                    FROM Actividad_Documento ad
                    INNER JOIN Actividad a ON ad.ClaveActividad = a.ClaveActividad
                    WHERE ClaveDocumento = @ClaveDocumento`);

        return result.recordset?.[0].nombreActividad || null;
    }

    async getDocumentsByActivity(claveActividad: string) {
        const pool = this.mssql.getPool();
        const result = await pool
            .request()
            .input('ClaveActividad', claveActividad)
            .query(`
                SELECT DISTINCT
                    ad.ClaveDocumento,
                    ad.ClaveDepartamento,
                    d.Nombre,
                    d.Tipo
                FROM SAPEDD.dbo.Actividad_Documento ad
                INNER JOIN SAPEDD.dbo.Documento d
                    ON ad.ClaveDocumento = d.ClaveDocumento
                WHERE ad.ClaveActividad = @ClaveActividad
            `);

        return result.recordset.map(row => ({
            claveDocumento: row.ClaveDocumento,
            departamento: row.ClaveDepartamento,
            nombre: row.Nombre,
            tipo: row.Tipo,
        }));
    }

}