const branchesController = require('../../controllers/branches.controller');

// Mock de los modelos
jest.mock('../../models', () => ({
  Branch: {
    findAndCountAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    count: jest.fn()
  },
  SalesPersonBranch: {
    findOne: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn()
  },
  SalesPerson: {
    findByPk: jest.fn()
  },
  Estimate: {
    count: jest.fn()
  }
}));

const { Branch, SalesPersonBranch, SalesPerson, Estimate } = require('../../models');

describe('Branches Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllBranches', () => {
    it('should return branches with pagination', async () => {
      const mockBranches = [
        { id: 1, name: 'Branch 1', address: 'Address 1' },
        { id: 2, name: 'Branch 2', address: 'Address 2' }
      ];

      Branch.findAndCountAll.mockResolvedValue({
        count: 2,
        rows: mockBranches
      });

      const req = createMockRequest({
        query: { page: 1, limit: 10 }
      });
      const res = createMockResponse();

      await branchesController.getAllBranches(req, res);

      expect(Branch.findAndCountAll).toHaveBeenCalledWith({
        where: {},
        include: [],
        limit: 10,
        offset: 0,
        order: [['name', 'ASC']],
        distinct: true
      });

      expect(res.json).toHaveBeenCalledWith({
        branches: mockBranches,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalCount: 2,
          hasNextPage: false,
          hasPrevPage: false
        }
      });
    });

    it('should handle search filter', async () => {
      Branch.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: [{ id: 1, name: 'Test Branch', address: 'Test Address' }]
      });

      const req = createMockRequest({
        query: { search: 'test' }
      });
      const res = createMockResponse();

      await branchesController.getAllBranches(req, res);

      expect(Branch.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            [require('sequelize').Op.or]: [
              { name: { [require('sequelize').Op.iLike]: '%test%' } },
              { address: { [require('sequelize').Op.iLike]: '%test%' } }
            ]
          }
        })
      );
    });

    it('should handle database errors', async () => {
      const error = new Error('Database connection failed');
      Branch.findAndCountAll.mockRejectedValue(error);

      const req = createMockRequest({});
      const res = createMockResponse();

      await branchesController.getAllBranches(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error al obtener branches',
        error: error.message
      });
    });
  });

  describe('getBranchById', () => {
    it('should return branch with details', async () => {
      const mockBranch = {
        id: 1,
        name: 'Test Branch',
        address: 'Test Address',
        SalesPersonBranches: [{ id: 1 }],
        Estimates: [{ id: 1, price: 1000 }],
        toJSON: () => ({
          id: 1,
          name: 'Test Branch',
          address: 'Test Address'
        })
      };

      Branch.findByPk.mockResolvedValue(mockBranch);

      const req = createMockRequest({
        params: { id: 1 }
      });
      const res = createMockResponse();

      await branchesController.getBranchById(req, res);

      expect(Branch.findByPk).toHaveBeenCalledWith(1, {
        include: expect.arrayContaining([
          expect.objectContaining({
            model: SalesPersonBranch
          }),
          expect.objectContaining({
            model: Estimate
          })
        ])
      });

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          name: 'Test Branch',
          address: 'Test Address',
          stats: {
            salesPersonsCount: 1,
            estimatesCount: 1,
            totalRevenue: 1000
          }
        })
      );
    });

    it('should return 404 when branch not found', async () => {
      Branch.findByPk.mockResolvedValue(null);

      const req = createMockRequest({
        params: { id: 999 }
      });
      const res = createMockResponse();

      await branchesController.getBranchById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Branch no encontrada'
      });
    });
  });

  describe('createBranch', () => {
    it('should create branch successfully', async () => {
      const mockBranch = {
        id: 1,
        name: 'New Branch',
        address: 'New Address'
      };

      Branch.findOne.mockResolvedValue(null); // No existe
      Branch.create.mockResolvedValue(mockBranch);

      const req = createMockRequest({
        body: {
          name: 'New Branch',
          address: 'New Address'
        }
      });
      const res = createMockResponse();

      await branchesController.createBranch(req, res);

      expect(Branch.findOne).toHaveBeenCalledWith({
        where: { name: 'New Branch' }
      });

      expect(Branch.create).toHaveBeenCalledWith({
        name: 'New Branch',
        address: 'New Address'
      });

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Branch creada exitosamente',
        branch: mockBranch
      });
    });

    it('should return 400 when branch name already exists', async () => {
      Branch.findOne.mockResolvedValue({ id: 1, name: 'Existing Branch' });

      const req = createMockRequest({
        body: {
          name: 'Existing Branch',
          address: 'Some Address'
        }
      });
      const res = createMockResponse();

      await branchesController.createBranch(req, res);

      expect(Branch.create).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Ya existe una branch con ese nombre'
      });
    });

    it('should return 400 when name is missing', async () => {
      const req = createMockRequest({
        body: {
          address: 'Some Address'
        }
      });
      const res = createMockResponse();

      await branchesController.createBranch(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'El nombre de la branch es requerido'
      });
    });
  });

  describe('deleteBranch', () => {
    it('should delete branch successfully', async () => {
      const mockBranch = {
        id: 1,
        name: 'Test Branch',
        destroy: jest.fn()
      };

      Branch.findByPk.mockResolvedValue(mockBranch);
      Estimate.count.mockResolvedValue(0); // No estimates
      SalesPersonBranch.destroy.mockResolvedValue();

      const req = createMockRequest({
        params: { id: 1 }
      });
      const res = createMockResponse();

      await branchesController.deleteBranch(req, res);

      expect(Estimate.count).toHaveBeenCalledWith({
        where: { branch_id: 1 }
      });

      expect(SalesPersonBranch.destroy).toHaveBeenCalledWith({
        where: { branch_id: 1 }
      });

      expect(mockBranch.destroy).toHaveBeenCalled();

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Branch eliminada exitosamente'
      });
    });

    it('should return 400 when branch has estimates', async () => {
      const mockBranch = { id: 1, name: 'Test Branch' };

      Branch.findByPk.mockResolvedValue(mockBranch);
      Estimate.count.mockResolvedValue(5); // Has estimates

      const req = createMockRequest({
        params: { id: 1 }
      });
      const res = createMockResponse();

      await branchesController.deleteBranch(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No se puede eliminar la branch porque tiene 5 estimate(s) asociado(s)'
      });
    });
  });

  describe('assignSalesPerson', () => {
    it('should assign salesperson to branch successfully', async () => {
      const mockBranch = { id: 1, name: 'Test Branch' };
      const mockSalesPerson = { id: 2, name: 'John Doe' };

      Branch.findByPk.mockResolvedValue(mockBranch);
      SalesPerson.findByPk.mockResolvedValue(mockSalesPerson);
      SalesPersonBranch.findOne.mockResolvedValue(null); // No existe
      SalesPersonBranch.create.mockResolvedValue();

      const req = createMockRequest({
        params: { id: 1 },
        body: { salesPersonId: 2 }
      });
      const res = createMockResponse();

      await branchesController.assignSalesPerson(req, res);

      expect(SalesPersonBranch.findOne).toHaveBeenCalledWith({
        where: { sales_person_id: 2, branch_id: 1 }
      });

      expect(SalesPersonBranch.create).toHaveBeenCalledWith({
        sales_person_id: 2,
        branch_id: 1
      });

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Salesperson asignado exitosamente a la branch'
      });
    });

    it('should return 400 when assignment already exists', async () => {
      const mockBranch = { id: 1, name: 'Test Branch' };
      const mockSalesPerson = { id: 2, name: 'John Doe' };

      Branch.findByPk.mockResolvedValue(mockBranch);
      SalesPerson.findByPk.mockResolvedValue(mockSalesPerson);
      SalesPersonBranch.findOne.mockResolvedValue({ id: 1 }); // Ya existe

      const req = createMockRequest({
        params: { id: 1 },
        body: { salesPersonId: 2 }
      });
      const res = createMockResponse();

      await branchesController.assignSalesPerson(req, res);

      expect(SalesPersonBranch.create).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'El salesperson ya está asignado a esta branch'
      });
    });

    it('should return 404 when branch not found', async () => {
      Branch.findByPk.mockResolvedValue(null);

      const req = createMockRequest({
        params: { id: 999 },
        body: { salesPersonId: 2 }
      });
      const res = createMockResponse();

      await branchesController.assignSalesPerson(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Branch no encontrada'
      });
    });

    it('should return 404 when salesperson not found', async () => {
      const mockBranch = { id: 1, name: 'Test Branch' };

      Branch.findByPk.mockResolvedValue(mockBranch);
      SalesPerson.findByPk.mockResolvedValue(null);

      const req = createMockRequest({
        params: { id: 1 },
        body: { salesPersonId: 999 }
      });
      const res = createMockResponse();

      await branchesController.assignSalesPerson(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Salesperson no encontrado'
      });
    });
  });
}); 