import { IsOptional, IsString, IsEmail } from 'class-validator';

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
  @IsString()
  ClaveDepartamento?: string;

  @IsOptional()
  @IsString()
  ClaveDocente?: string;
}