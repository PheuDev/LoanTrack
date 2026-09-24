import { eq } from 'drizzle-orm';
import { db, insertAndFetch, updateAndFetch } from '../db/index.js';
import { clients, loans } from '../db/schema.js';
import { AppError } from '../middlewares/AppError.js';
import { calculerEtatPret } from '../services/loanService.js';
import { calculerStatutClientReel } from '../services/clientService.js';

/**
 * GET /clients
 * Retourne la liste de tous les clients.
 * Query params optionnels : status ('actif' | 'suspendu'), search (nom ou téléphone)
 */
export async function getClients(req, res, next) {
  try {
    const { status, search } = req.query;

    // Récupère tous les clients avec leurs prêts pour calculer le statut réel
    // (`suspendu` n'est jamais persisté — il est déduit des échéances à la lecture).
    const clientsBruts = await db.query.clients.findMany({
      with: {
        loans: {
          columns: { status: true, totalDue: true, penalties: true, dueDate: true },
          with: { repayments: { columns: { amount: true } } },
        },
      },
      orderBy: (c, { asc }) => [asc(c.lastName)],
    });

    let allClients = clientsBruts.map(({ loans: prets, ...client }) => ({
      ...client,
      status: calculerStatutClientReel(prets),
    }));

    if (status && ['actif', 'suspendu'].includes(status)) {
      allClients = allClients.filter((c) => c.status === status);
    }

    if (search) {
      const terme = search.toLowerCase();
      allClients = allClients.filter((c) =>
        c.firstName.toLowerCase().includes(terme) ||
        c.lastName.toLowerCase().includes(terme) ||
        c.phone.includes(terme)
      );
    }

    return res.json({ data: allClients });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /clients
 * Crée un nouveau client. Les données sont validées en amont par validate().
 */
export async function createClient(req, res, next) {
  try {
    const { firstName, lastName, phone, address, notes } = req.body;

    // Vérifie l'unicité du téléphone (la contrainte DB le ferait aussi, mais on préfère
    // un message d'erreur clair plutôt qu'une erreur MySQL brute)
    const existing = await db.select().from(clients).where(eq(clients.phone, phone));
    if (existing.length > 0) {
      return next(new AppError(
        `Le numéro de téléphone ${phone} est déjà utilisé par un autre client.`,
        'PHONE_ALREADY_EXISTS',
        409
      ));
    }

    const newClient = await insertAndFetch(clients, {
      firstName,
      lastName,
      phone,
      address: address || null,
      notes: notes || null,
    });

    return res.status(201).json({ data: newClient });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /clients/:id
 * Retourne le détail d'un client avec la liste de ses prêts (statut et solde calculés).
 */
export async function getClientById(req, res, next) {
  try {
    const clientId = parseInt(req.params.id, 10);
    if (!Number.isInteger(clientId)) {
      return next(new AppError('Client introuvable.', 'CLIENT_NOT_FOUND', 404));
    }

    const clientResult = await db.select().from(clients).where(eq(clients.id, clientId));
    if (clientResult.length === 0) {
      return next(new AppError('Client introuvable.', 'CLIENT_NOT_FOUND', 404));
    }

    const client = clientResult[0];

    // Charge les prêts du client avec le total remboursé calculé par SQL
    const loansResult = await db.query.loans.findMany({
      where: eq(loans.clientId, clientId),
      with: {
        repayments: {
          columns: { amount: true },
        },
      },
      orderBy: (loans, { desc }) => [desc(loans.createdAt)],
    });

    // Calcule le solde et le statut en temps réel pour chaque prêt
    const loansAvecSolde = loansResult.map((loan) => {
      const { soldeRestant, totalRembourse, statut, joursRetard } = calculerEtatPret(loan);

      return {
        id: loan.id,
        level: loan.level,
        principal: loan.principal,
        totalDue: loan.totalDue,
        penalties: loan.penalties,
        soldeRestant,
        totalRembourse,
        status: statut,
        startDate: loan.startDate,
        dueDate: loan.dueDate,
        joursRetard,
        createdAt: loan.createdAt,
      };
    });

    // Statut réel du client (temps réel — jamais le champ brut en base)
    const statutClient = calculerStatutClientReel(loansResult);

    return res.json({
      data: {
        ...client,
        status: statutClient,
        loans: loansAvecSolde,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * PATCH /clients/:id
 * Modifie les informations d'un client (seuls les champs fournis sont mis à jour).
 */
export async function updateClient(req, res, next) {
  try {
    const clientId = parseInt(req.params.id, 10);
    if (!Number.isInteger(clientId)) {
      return next(new AppError('Client introuvable.', 'CLIENT_NOT_FOUND', 404));
    }

    const clientResult = await db.select().from(clients).where(eq(clients.id, clientId));
    if (clientResult.length === 0) {
      return next(new AppError('Client introuvable.', 'CLIENT_NOT_FOUND', 404));
    }

    const { firstName, lastName, phone, address, notes } = req.body;

    // Vérifie l'unicité du nouveau téléphone si fourni
    if (phone && phone !== clientResult[0].phone) {
      const existing = await db.select().from(clients).where(eq(clients.phone, phone));
      if (existing.length > 0) {
        return next(new AppError(
          `Le numéro ${phone} est déjà utilisé par un autre client.`,
          'PHONE_ALREADY_EXISTS',
          409
        ));
      }
    }

    // Construit l'objet de mise à jour avec uniquement les champs fournis
    const updates = { updatedAt: new Date() };
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName  !== undefined) updates.lastName  = lastName;
    if (phone     !== undefined) updates.phone      = phone;
    if (address   !== undefined) updates.address    = address;
    if (notes     !== undefined) updates.notes      = notes;

    const updatedClient = await updateAndFetch(clients, updates, clientId);

    return res.json({ data: updatedClient });
  } catch (error) {
    return next(error);
  }
}
