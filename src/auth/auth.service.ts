import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../config/prisma.service';
import { TeamsService } from '../teams/teams.service';
import { AuthDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly teamsService: TeamsService,
  ) {}

  async authenticate(authDto: AuthDto) {
    const { email, password } = authDto;

    this.logger.log(`Authentication attempt for email: ${email}`);

    let user = await this.prisma.user.findUnique({
      where: { email },
    });
    let successMessage = 'User authenticated successfully';

    if (user) {
      this.logger.log(`User found, validating password for: ${email}`);
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        this.logger.warn(`Invalid password attempt for: ${email}`);
        throw new UnauthorizedException('Invalid credentials');
      }
      this.logger.log(`Login successful for: ${email}`);
    }

    if (!user) {
      this.logger.log(`New user registration for: ${email}`);
      const hashedPassword = await bcrypt.hash(password, 10);

      user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
        },
      });
      successMessage = 'User registered successfully';
      this.logger.log(`User created with ID: ${user.id}`);

      // Create team in background (don't wait for it to complete)
      const newUserId = user.id;
      this.logger.log(`Triggering team creation for user: ${newUserId}`);
      this.teamsService.createTeamForUser(newUserId).catch((error) => {
        this.logger.error(
          `Failed to create team for user ${newUserId}:`,
          error,
        );
      });
    }

    const token = this.generateToken(user.id, user.email);

    return {
      message: successMessage,
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }

  private generateToken(userId: string, email: string): string {
    const payload = { sub: userId, email };
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '7d';
    // @ts-expect-error - expiresIn accepts string values like '7d', '1h', etc.
    return this.jwtService.sign(payload, { expiresIn });
  }
}
