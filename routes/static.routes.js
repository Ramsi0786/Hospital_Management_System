import express from "express";
const router = express.Router();
import * as staticController from "../controllers/static.controller.js";
import { publicAuth } from "../middleware/publicAuth.middleware.js";

router.use(publicAuth);

router.route('/').get(staticController.landingPage);
router.route('/login').get(staticController.loginPage);
router.route('/about-us').get(staticController.aboutUsPage);
router.route('/services').get(staticController.servicesPage);
router.route('/contact')
  .get(staticController.contactPage)
  .post(staticController.submitContact); 
router.route('/doctors').get(staticController.doctorsPage);
router.route('/doctors/:id').get(staticController.doctorDetailPage);
router.route('/departments').get(staticController.departmentsPage);
router.route('/departments/:name').get(staticController.departmentPage);

export default router;