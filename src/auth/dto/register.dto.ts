import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator'

export class RegisterDto {
  @ApiProperty({ example: 'Ada Lovelace' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string

  @ApiProperty({ example: 'ada@example.com' })
  @IsEmail()
  email: string

  @ApiProperty({ example: 'strongPassword123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string
}
