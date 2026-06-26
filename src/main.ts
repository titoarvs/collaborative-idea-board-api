import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import cookieParser from 'cookie-parser'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.use(cookieParser())
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true })
  )
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  })

  const config = new DocumentBuilder()
    .setTitle('Collaborative Idea Board API')
    .setDescription('NestJS API for teams, ideas, retro canvas')
    .setVersion('1.0')
    .addCookieAuth('access_token')
    .build()
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('docs', app, document)

  const port = Number(process.env.PORT ?? 4000)
  await app.listen(port)
  console.log(`API listening on http://localhost:${port}`)
}

void bootstrap()
