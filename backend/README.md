# FIMAAC — Backend & Architecture (NestJS + PostgreSQL)
> **Objectif** : transformer le prototype front-end (React + Vite + localStorage) en une plateforme SaaS
> réellement exploitable multi-cabinets. Ce dossier contient le **socle production** :
> schéma Prisma (PostgreSQL), stack Docker, et exemples NestJS prêts à brancher.

---

## 1. Stack cible

| Couche | Technologie |
|---|---|
| Frontend | Next.js · TypeScript · Tailwind · shadcn/ui (port du prototype V0.x actuel) |
| Backend | **NestJS** · TypeScript · modular monolith |
| Base de données | **PostgreSQL** + **Prisma** (UUID, FK, indexes, check constraints) |
| Cache / Files | **Redis** (+ BullMQ pour les jobs) |
| Stockage objets | **S3-compatible** (MinIO en local) |
| Recherche | PostgreSQL Full-Text → OpenSearch plus tard |
| Infra | Docker · CI/CD · Monitoring · Backups · Secrets |

## 2. Structure du monorepo
```
fimaac/
├─ apps/
│  ├─ web/        # Next.js (port du front actuel)
│  ├─ api/        # NestJS (REST /api/v1)
│  └─ mobile/     # React Native / Expo (plus tard)
├─ packages/
│  ├─ accounting/  taxation/  regulatory/  documents/  reporting/
│  ├─ payroll/     banking/    compliance/  ai/          shared/   ui/
├─ database/      # migrations · seeds · fixtures
└─ infrastructure/ # docker · deployment · monitoring
```

## 3. Démarrage rapide
```bash
# 1. Stack (Postgres + Redis + MinIO + API + Web)
docker compose -f backend/docker-compose.yml up -d

# 2. Base de données
cd apps/api
cp .env.example .env            # DATABASE_URL, JWT_SECRET, S3_*, REDIS_URL
npx prisma migrate dev --name init
npx prisma db seed              # cabinet démo + admin + plan SYSCOHADA

# 3. Lancer l'API (dev)
npm run start:dev               # http://localhost:4000/api  (Swagger /docs)

# 4. Frontend
cd ../web && npm run dev        # http://localhost:3000
```
> Compte admin initial (seed) : `fimaac@gmail.com` / `Fimaac@2000` — **à changer en production**.

## 4. Multi-tenant & sécurité
- Chaque table métier porte `organizationId` + `@@index` (cf. `schema.prisma`).
- Un **TenantGuard** (NestJS) injecte `organizationId` depuis le JWT et **filtre toutes les requêtes** :
  aucun cabinet ne peut lire les données d'un autre.
- RBAC granulaire via `@Roles()` + `RolesGuard` (16 permissions).
- Hachage mot de passe **bcrypt/argon2 côté serveur** (le hash navigateur du prototype est retiré).
- JWT court + refresh token rotatif, 2FA TOTP optionnel.
- Rate limiting, validation DTO (class-validator), helmet, CORS strict, secrets en variables d'env.

## 5. Intégrité comptable (règle absolue débit = crédit)
Service d'exemple `packages/accounting` (logique métier **hors UI**, testable unitairement) :
```ts
// accounting.service.ts
@Injectable()
export class AccountingService {
  constructor(private prisma: PrismaService) {}

  async validateEntry(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findUnique({
        where: { id },
        include: { lines: true, company: true },
      });
      if (!entry) throw new NotFoundException();
      // TENANT ISOLATION
      if (entry.organizationId !== ctx.orgId) throw new ForbiddenException();

      const debit  = entry.lines.reduce((s, l) => s + l.debit, 0);
      const credit = entry.lines.reduce((s, l) => s + l.credit, 0);
      // RÈGLE ABSOLUE
      if (debit !== credit)
        throw new BadRequestException(
          `Écriture déséquilibrée : écart de ${debit - credit} FCFA`,
        );
      if (debit === 0) throw new BadRequestException('Montant nul');

      return tx.journalEntry.update({
        where: { id },
        data: { status: 'VALIDATED', validatorId: userId },
      });
    });
  }

  // Contrepassation avec audit trail (jamais de suppression silencieuse)
  async counterpass(id: string, userId: string) { /* inverse débit/crédit, status VALIDATED */ }
}
```
```ts
// accounting.controller.ts
@ApiTags('accounting')
@Controller('api/v1/accounting/entries')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class AccountingController {
  constructor(private svc: AccountingService) {}

  @Post(':id/validate') @Roles('ACCOUNTANT','CABINET_ADMIN')
  validate(@Param('id') id: string, @ReqUser() u: ReqUser) { return this.svc.validateEntry(id, u.id); }
}
```
> La même logique existe déjà dans le prototype (`src/lib/accounting.ts`, `src/lib/actions.ts`) ;
> elle sera déplacée dans `packages/accounting` et partagée front/back.

## 6. API REST (`/api/v1`)
```
/auth · /users · /organizations · /companies
/accounting/{frameworks,accounts,journals,entries,ledger,trial-balance,reconciliation,closing}
/documents · /documents/upload · /documents/ocr
/banking · /banking/transactions · /banking/reconciliation
/fixed-assets · /inventory · /payroll · /employees
/tax/{profiles,types,rules,declarations,deadlines}
/financial-statements · /liasse · /reports
/compliance · /regulatory · /missions · /tasks
/notifications · /ai
```
OpenAPI/Swagger sur `/docs`. Format d'erreur standard :
```json
{ "code": "UNBALANCED_ENTRY", "message": "...", "details": {}, "requestId": "..." }
```

## 7. Jobs asynchrones (Redis + BullMQ)
`document.ocr` · `document.extract` · `document.classify` · `report.generate` ·
`tax.calculate` · `notification.send` · `email.send` · `ai.analyze` · `bank.import` · `backup.process`.
> Dans le prototype ces tâches sont simulées (`setTimeout`) — ici elles deviennent de vrais workers.

## 8. Liasses fiscales GUDEF
- Mode A : génération multi-feuilles (Balance N-1/N, CR, Bilan, TAFIRE, annexes) via **ExcelJS** (déjà utilisé côté front).
- Mode B : import du modèle GUDEF officiel, remplissage par mapping compte→cellule, **export non destructif**.
- Contrôles de cohérence (actif=passif, Σ débit= crédit, résultat CR=passif…) exécutés côté serveur + audit trail.
- Dépôt réel GUDEF/OTR : **adapter** documenté (aucune API officielle connectée tant que non disponible).

## 9. Correspondance prototype ↔ production
| Prototype (front) | Production (backend) |
|---|---|
| `src/lib/store.ts` (localStorage) | **PostgreSQL + Prisma** |
| `src/lib/auth.ts` (hash navigateur) | **NestJS Auth + bcrypt + JWT + 2FA** |
| `src/lib/accounting.ts` | `packages/accounting` (partagé) |
| `src/lib/tax.ts` / `regulatory` | `packages/taxation` + `regulatory` (versionné en DB) |
| `src/lib/liasse.ts` (ExcelJS) | `packages/reporting` (même lib, exécution serveur) |
| OCR/IA simulés | Workers OCR + LLM (RAG sur sources réglementaires) |
| Paiement simulé | Adapter Mobile Money / carte |

## 10. Roadmap des phases (déjà couvertes côté front)
- ✅ V0.1 : foundation, comptabilité, fiscalité, documents, états, conformité, IA, multi-tenant, RBAC
- ✅ V0.2 : demandes documentaires, paiements fiscaux, recherche globale, services client, liasses GUDEF
- ✅ V0.3 : lettrage, rapprochement pro, paie complète, stocks persistés, amortissements auto, grille TVA, dossier permanent
- ⏳ Backlog : analytique multi-axes, multi-devises, messagerie par dossier, TAFIRE/annexes liasse, dépôt GUDEF réel
