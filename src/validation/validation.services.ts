import { Injectable } from "@nestjs/common";
import { MssqlService } from '@strongnguyen/nestjs-mssql';
import { DynamicDatabaseService } from '../database/dynamic-database.service';
import { FilesService } from "../files/files.service";

@Injectable()
export class ValidationServices {
    constructor(
        private readonly mssql: MssqlService,
        private readonly filesService: FilesService,
    ) {}

    async cargaReglamentaria() {
        
    }
}