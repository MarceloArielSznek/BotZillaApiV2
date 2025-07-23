const { validateBranch, validateSalesPerson, validateStatus } = require('../../middleware/validation.middleware');

describe('Validation Middleware', () => {
  describe('validateBranch', () => {
    describe('create validation', () => {
      it('should pass validation with valid branch data', () => {
        const req = createMockRequest({
          body: {
            name: 'Test Branch',
            address: '123 Test St'
          }
        });
        const res = createMockResponse();
        const next = createMockNext();

        validateBranch.create(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
        expect(req.body.name).toBe('Test Branch');
        expect(req.body.address).toBe('123 Test St');
      });

      it('should fail validation with missing name', () => {
        const req = createMockRequest({
          body: {
            address: '123 Test St'
          }
        });
        const res = createMockResponse();
        const next = createMockNext();

        validateBranch.create(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            message: 'Invalid input data',
            errors: expect.arrayContaining([
              expect.objectContaining({
                field: 'name',
                message: expect.stringContaining('required')
              })
            ])
          })
        );
      });

      it('should fail validation with empty name', () => {
        const req = createMockRequest({
          body: {
            name: '',
            address: '123 Test St'
          }
        });
        const res = createMockResponse();
        const next = createMockNext();

        validateBranch.create(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should fail validation with name too short', () => {
        const req = createMockRequest({
          body: {
            name: 'A',
            address: '123 Test St'
          }
        });
        const res = createMockResponse();
        const next = createMockNext();

        validateBranch.create(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({
                field: 'name',
                message: expect.stringContaining('2 characters')
              })
            ])
          })
        );
      });

      it('should trim and sanitize input data', () => {
        const req = createMockRequest({
          body: {
            name: '  Test Branch  ',
            address: '  123 Test St  '
          }
        });
        const res = createMockResponse();
        const next = createMockNext();

        validateBranch.create(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.body.name).toBe('Test Branch');
        expect(req.body.address).toBe('123 Test St');
      });

      it('should strip unknown fields', () => {
        const req = createMockRequest({
          body: {
            name: 'Test Branch',
            address: '123 Test St',
            unknownField: 'should be removed'
          }
        });
        const res = createMockResponse();
        const next = createMockNext();

        validateBranch.create(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.body.unknownField).toBeUndefined();
      });
    });

    describe('params validation', () => {
      it('should pass validation with valid numeric ID', () => {
        const req = createMockRequest({
          params: { id: '123' }
        });
        const res = createMockResponse();
        const next = createMockNext();

        validateBranch.params(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.params.id).toBe(123);
      });

      it('should fail validation with non-numeric ID', () => {
        const req = createMockRequest({
          params: { id: 'abc' }
        });
        const res = createMockResponse();
        const next = createMockNext();

        validateBranch.params(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should fail validation with negative ID', () => {
        const req = createMockRequest({
          params: { id: '-5' }
        });
        const res = createMockResponse();
        const next = createMockNext();

        validateBranch.params(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe('list validation', () => {
      it('should pass validation with valid query params', () => {
        const req = createMockRequest({
          query: {
            page: '1',
            limit: '10',
            search: 'test',
            includeStats: 'true'
          }
        });
        const res = createMockResponse();
        const next = createMockNext();

        validateBranch.list(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.query.page).toBe(1);
        expect(req.query.limit).toBe(10);
        expect(req.query.search).toBe('test');
        expect(req.query.includeStats).toBe(true);
      });

      it('should use default values for missing params', () => {
        const req = createMockRequest({
          query: {}
        });
        const res = createMockResponse();
        const next = createMockNext();

        validateBranch.list(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.query.page).toBe(1);
        expect(req.query.limit).toBe(10);
        expect(req.query.includeStats).toBe(false);
      });

      it('should fail validation with invalid page number', () => {
        const req = createMockRequest({
          query: { page: '0' }
        });
        const res = createMockResponse();
        const next = createMockNext();

        validateBranch.list(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should fail validation with limit too high', () => {
        const req = createMockRequest({
          query: { limit: '1000' }
        });
        const res = createMockResponse();
        const next = createMockNext();

        validateBranch.list(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
      });
    });
  });

  describe('validateSalesPerson', () => {
    describe('create validation', () => {
      it('should pass validation with valid salesperson data', () => {
        const req = createMockRequest({
          body: {
            name: 'John Doe',
            phone: '+1234567890',
            telegram_id: '@johndoe',
            branchIds: [1, 2]
          }
        });
        const res = createMockResponse();
        const next = createMockNext();

        validateSalesPerson.create(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.body.name).toBe('John Doe');
        expect(req.body.phone).toBe('+1234567890');
        expect(req.body.telegram_id).toBe('@johndoe');
        expect(req.body.branchIds).toEqual([1, 2]);
      });

      it('should fail validation with invalid phone format', () => {
        const req = createMockRequest({
          body: {
            name: 'John Doe',
            phone: 'invalid-phone'
          }
        });
        const res = createMockResponse();
        const next = createMockNext();

        validateSalesPerson.create(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({
                field: 'phone',
                message: expect.stringContaining('Phone format is not valid')
              })
            ])
          })
        );
      });

      it('should fail validation with duplicate branch IDs', () => {
        const req = createMockRequest({
          body: {
            name: 'John Doe',
            branchIds: [1, 1, 2]
          }
        });
        const res = createMockResponse();
        const next = createMockNext();

        validateSalesPerson.create(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
      });
    });
  });

  describe('validateStatus', () => {
    describe('create validation', () => {
      it('should pass validation with valid status data', () => {
        const req = createMockRequest({
          body: {
            name: 'Active'
          }
        });
        const res = createMockResponse();
        const next = createMockNext();

        validateStatus.create(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.body.name).toBe('Active');
      });

      it('should fail validation with name too long', () => {
        const req = createMockRequest({
          body: {
            name: 'A'.repeat(60) // Más de 50 caracteres
          }
        });
        const res = createMockResponse();
        const next = createMockNext();

        validateStatus.create(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
      });
    });
  });
}); 