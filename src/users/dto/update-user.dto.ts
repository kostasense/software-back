import { IsOptional, IsString, IsEmail, IsNumber } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  Correo?: string;

  @IsOptional()
  @IsString()
  Contrasena?: string;

  @IsOptional()
  @IsString()
  Rol?: string;

  @IsOptional()
  @IsNumber()
  ClaveDepartamento?: number;

  @IsOptional()
  @IsNumber()
  ClaveDocente?: number;
}