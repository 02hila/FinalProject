/**
 * Companies Routes Module
 *
 * This module provides endpoints for managing company records in the system.
 * It includes CRUD operations for companies, with authentication required for
 * most operations to ensure proper access control.
 *
 * @module routes/companies
 */

const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const { authMiddleware } = require('../middleware/auth');

/**
 * Get All Companies
 *
 * Retrieves a list of all companies in the system, sorted by creation date (newest first).
 * This endpoint requires authentication.
 *
 * @route GET /api/companies
 * @middleware authMiddleware - Requires user authentication
 * @returns {Object} JSON response with success status and companies array
 * @property {boolean} success - Whether the operation was successful
 * @property {Array} companies - Array of company objects
 * @throws {500} If there's an error fetching companies
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const companies = await Company.find().sort({ createdAt: -1 });
    res.json({ success: true, companies });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create New Company
 *
 * Creates a new company record in the system. This endpoint does not require
 * authentication to allow public company registration.
 *
 * @route POST /api/companies
 * @param {Object} req.body - Company data to create
 * @returns {Object} JSON response with success status and created company
 * @property {boolean} success - Whether the operation was successful
 * @property {Object} company - The created company object
 * @throws {500} If there's an error creating the company
 */
router.post('/', async (req, res) => {
  try {
    const company = new Company(req.body);
    await company.save();
    res.json({ success: true, company });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get Company by ID
 *
 * Retrieves a specific company by its ID. This endpoint requires authentication.
 *
 * @route GET /api/companies/:id
 * @middleware authMiddleware - Requires user authentication
 * @param {string} req.params.id - Company ID to retrieve
 * @returns {Object} JSON response with success status and company data
 * @property {boolean} success - Whether the operation was successful
 * @property {Object} company - The company object
 * @throws {500} If there's an error fetching the company
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    res.json({ success: true, company });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update Company
 *
 * Updates an existing company record by ID. This endpoint requires authentication.
 *
 * @route PUT /api/companies/:id
 * @middleware authMiddleware - Requires user authentication
 * @param {string} req.params.id - Company ID to update
 * @param {Object} req.body - Updated company data
 * @returns {Object} JSON response with success status and updated company
 * @property {boolean} success - Whether the operation was successful
 * @property {Object} company - The updated company object
 * @throws {500} If there's an error updating the company
 */
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const company = await Company.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, company });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete Company
 *
 * Deletes a company record by ID. This endpoint requires authentication.
 *
 * @route DELETE /api/companies/:id
 * @middleware authMiddleware - Requires user authentication
 * @param {string} req.params.id - Company ID to delete
 * @returns {Object} JSON response with success status
 * @property {boolean} success - Whether the operation was successful
 * @throws {500} If there's an error deleting the company
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await Company.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;